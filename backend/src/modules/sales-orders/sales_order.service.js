'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { nextSequence, formatCode } = require('../../common/sequence');
const salesOrderRepository = require('./sales_order.repository');
const customerRepository = require('../customers/customer.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const productRepository = require('../products/product.repository');
const inventoryService = require('../inventory/inventory.service');

/**
 * Servicio de PEDIDOS DE VENTA (FASE 4) — multiempresa estricto.
 *
 * Reglas (ADR-010):
 *  - companyId SALE SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - Sólo se crea/edita en DRAFT; sin DELETE (se rechaza el documento).
 *  - APROBAR genera una SALIDA de inventario por línea con decremento
 *    CONDICIONAL (409 "Stock insuficiente en el almacén indicado." si no
 *    alcanza); si una línea posterior falla, se reponen las ya descontadas
 *    (entradas de compensación) y el estado NO cambia.
 *  - `total` lo calcula el servidor; `code` sale del contador atómico (ADR-009).
 */

const CODE_KEY = 'sales_orders';
const CODE_PREFIX = 'SO';

const round2 = (n) => Math.round(n * 100) / 100;

async function loadCustomer(customerId, companyId) {
  const customer = await customerRepository.findById(customerId, { companyId });
  if (!customer) throw ApiError.notFound('Recurso no encontrado.');
  if (customer.status !== 'active') {
    throw ApiError.conflict('El cliente está inactivo; no admite pedidos de venta.');
  }
  return customer;
}

async function resolveWarehouse(warehouseId, companyId) {
  let warehouse;
  if (warehouseId) {
    warehouse = await warehouseRepository.findById(warehouseId, { companyId });
    if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
  } else {
    warehouse = await warehouseRepository.findDefault(companyId);
    if (!warehouse) throw ApiError.conflict('La empresa no tiene un almacén predeterminado.');
  }
  if (warehouse.status !== 'active') {
    throw ApiError.conflict('El almacén está inactivo; no admite movimientos de inventario.');
  }
  return warehouse;
}

/** Valida cada línea (producto ajeno ⇒ 404, inactivo ⇒ 409) y suma el total. */
async function validateLines(lines, companyId) {
  let total = 0;
  for (const line of lines) {
    const product = await productRepository.findById(line.productId, { companyId });
    if (!product) throw ApiError.notFound('Recurso no encontrado.');
    if (product.status !== 'active') {
      throw ApiError.conflict('El producto está inactivo; no admite movimientos de inventario.');
    }
    total += line.quantity * line.unitPrice;
  }
  return round2(total);
}

async function prepare(data, companyId) {
  const customer = await loadCustomer(data.customerId, companyId);
  const warehouse = await resolveWarehouse(data.warehouseId, companyId);
  const total = await validateLines(data.lines, companyId);
  return { customerId: customer._id, warehouseId: warehouse._id, total };
}

/** Repone SALIDAS ya descontadas durante una aprobación fallida (mejor esfuerzo). */
async function compensateExits(lines, warehouseId, actor, code) {
  for (const line of lines) {
    await inventoryService
      .entry({
        productId: line.productId,
        warehouseId,
        quantity: line.quantity,
        reason: `Compensación de aprobación ${code}`,
        reference: code,
      }, actor)
      .catch((err) =>
        logger.error({ err: err.message }, 'Compensación de aprobación de venta falló')
      );
  }
}

const salesOrderService = {
  async list(filter, options) {
    return salesOrderRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return salesOrderRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const prepared = await prepare(data, companyId);
    const seq = await nextSequence(companyId, CODE_KEY);

    return salesOrderRepository.create({
      companyId,
      code: formatCode(CODE_PREFIX, seq),
      status: 'DRAFT',
      lines: data.lines,
      notes: data.notes || null,
      createdBy: userId || null,
      ...prepared,
    });
  },

  async update(id, data, companyId) {
    const order = await salesOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status !== 'DRAFT') {
      throw ApiError.conflict('Sólo los documentos en borrador pueden modificarse.');
    }

    const patch = {};
    const touchesDocument = ['customerId', 'warehouseId', 'lines'].some(
      (k) => data[k] !== undefined
    );
    if (touchesDocument) {
      Object.assign(
        patch,
        await prepare(
          {
            customerId: data.customerId !== undefined ? data.customerId : order.customerId,
            warehouseId:
              data.warehouseId !== undefined ? data.warehouseId : String(order.warehouseId),
            lines: data.lines !== undefined ? data.lines : order.lines,
          },
          companyId
        )
      );
    }
    if (data.lines !== undefined) patch.lines = data.lines;
    if (data.notes !== undefined) patch.notes = data.notes;

    return salesOrderRepository.updateById(id, patch, { companyId });
  },

  /** Aprueba y ejecuta las SALIDAS de inventario; reversión si algo falla. */
  async approve(id, companyId, userId) {
    const order = await salesOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'APPROVED') throw ApiError.conflict('El pedido ya fue aprobado.');
    if (order.status === 'REJECTED') {
      throw ApiError.conflict('El pedido fue rechazado; no puede aprobarse.');
    }

    // Revalida el cliente y el almacén en el momento de aprobar.
    await loadCustomer(order.customerId, companyId);
    const warehouse = await warehouseRepository.findById(order.warehouseId, { companyId });
    if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
    if (warehouse.status !== 'active') {
      throw ApiError.conflict('El almacén está inactivo; no admite movimientos de inventario.');
    }

    const actor = { companyId, userId };
    const applied = [];
    try {
      for (const line of order.lines) {
        await inventoryService.exit(
          {
            productId: line.productId,
            warehouseId: warehouse._id,
            quantity: line.quantity,
            reason: `Aprobación de pedido de venta ${order.code}`,
            reference: order.code,
          },
          actor
        );
        applied.push(line);
      }
    } catch (err) {
      await compensateExits(applied, warehouse._id, actor, order.code);
      throw err;
    }

    try {
      return await salesOrderRepository.updateById(
        id,
        { status: 'APPROVED', approvedBy: userId || null, approvedAt: new Date() },
        { companyId }
      );
    } catch (err) {
      await compensateExits(order.lines, warehouse._id, actor, order.code);
      throw err;
    }
  },

  async reject(id, data, companyId, userId) {
    const order = await salesOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'APPROVED') {
      throw ApiError.conflict('El pedido aprobado no puede rechazarse.');
    }
    if (order.status === 'REJECTED') throw ApiError.conflict('El pedido ya fue rechazado.');

    return salesOrderRepository.updateById(
      id,
      {
        status: 'REJECTED',
        rejectedBy: userId || null,
        rejectedAt: new Date(),
        rejectionReason: data.reason,
      },
      { companyId }
    );
  },
};

module.exports = salesOrderService;
