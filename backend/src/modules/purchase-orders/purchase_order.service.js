'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { nextSequence, formatCode } = require('../../common/sequence');
const purchaseOrderRepository = require('./purchase_order.repository');
const supplierRepository = require('../suppliers/supplier.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const productRepository = require('../products/product.repository');
const inventoryService = require('../inventory/inventory.service');

/**
 * Servicio de ÓRDENES DE COMPRA (FASE 4) — multiempresa estricto.
 *
 * Reglas (ADR-010):
 *  - companyId SALE SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - Sólo se crea/edita en DRAFT; sin DELETE (se rechaza el documento).
 *  - APROBAR genera una ENTRADA de inventario por línea (inventory.service,
 *    con sus compensaciones internas, ADR-008); si una línea posterior falla,
 *    se compensan las entradas ya creadas con salidas y el estado NO cambia.
 *  - `total` lo calcula el servidor; `code` sale del contador atómico (ADR-009).
 */

const CODE_KEY = 'purchase_orders';
const CODE_PREFIX = 'PO';

const round2 = (n) => Math.round(n * 100) / 100;

async function loadSupplier(supplierId, companyId) {
  const supplier = await supplierRepository.findById(supplierId, { companyId });
  if (!supplier) throw ApiError.notFound('Recurso no encontrado.');
  if (supplier.status !== 'active') {
    throw ApiError.conflict('El proveedor está inactivo; no admite órdenes de compra.');
  }
  return supplier;
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
    total += line.quantity * line.unitCost;
  }
  return round2(total);
}

async function prepare(data, companyId) {
  const supplier = await loadSupplier(data.supplierId, companyId);
  const warehouse = await resolveWarehouse(data.warehouseId, companyId);
  const total = await validateLines(data.lines, companyId);
  return { supplierId: supplier._id, warehouseId: warehouse._id, total };
}

/** Deshace ENTRADAS ya creadas durante una aprobación fallida (mejor esfuerzo). */
async function compensateEntries(lines, warehouseId, actor, code) {
  for (const line of lines) {
    await inventoryService
      .exit({
        productId: line.productId,
        warehouseId,
        quantity: line.quantity,
        reason: `Compensación de aprobación ${code}`,
        reference: code,
      }, actor)
      .catch((err) =>
        logger.error({ err: err.message }, 'Compensación de aprobación de compra falló')
      );
  }
}

const purchaseOrderService = {
  async list(filter, options) {
    return purchaseOrderRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return purchaseOrderRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const prepared = await prepare(data, companyId);
    const seq = await nextSequence(companyId, CODE_KEY);

    return purchaseOrderRepository.create({
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
    const order = await purchaseOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status !== 'DRAFT') {
      throw ApiError.conflict('Sólo los documentos en borrador pueden modificarse.');
    }

    const patch = {};
    const touchesDocument = ['supplierId', 'warehouseId', 'lines'].some(
      (k) => data[k] !== undefined
    );
    if (touchesDocument) {
      Object.assign(
        patch,
        await prepare(
          {
            supplierId: data.supplierId !== undefined ? data.supplierId : order.supplierId,
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

    return purchaseOrderRepository.updateById(id, patch, { companyId });
  },

  /** Aprueba y ejecuta las ENTRADAS de inventario; reversión si algo falla. */
  async approve(id, companyId, userId) {
    const order = await purchaseOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'APPROVED') throw ApiError.conflict('La orden ya fue aprobada.');
    if (order.status === 'REJECTED') {
      throw ApiError.conflict('La orden fue rechazada; no puede aprobarse.');
    }

    // Revalida el proveedor y el almacén en el momento de aprobar.
    await loadSupplier(order.supplierId, companyId);
    const warehouse = await warehouseRepository.findById(order.warehouseId, { companyId });
    if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
    if (warehouse.status !== 'active') {
      throw ApiError.conflict('El almacén está inactivo; no admite movimientos de inventario.');
    }

    const actor = { companyId, userId };
    const applied = [];
    try {
      for (const line of order.lines) {
        await inventoryService.entry(
          {
            productId: line.productId,
            warehouseId: warehouse._id,
            quantity: line.quantity,
            reason: `Aprobación de orden de compra ${order.code}`,
            reference: order.code,
          },
          actor
        );
        applied.push(line);
      }
    } catch (err) {
      await compensateEntries(applied, warehouse._id, actor, order.code);
      throw err;
    }

    try {
      return await purchaseOrderRepository.updateById(
        id,
        { status: 'APPROVED', approvedBy: userId || null, approvedAt: new Date() },
        { companyId }
      );
    } catch (err) {
      await compensateEntries(order.lines, warehouse._id, actor, order.code);
      throw err;
    }
  },

  async reject(id, data, companyId, userId) {
    const order = await purchaseOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'APPROVED') {
      throw ApiError.conflict('La orden aprobada no puede rechazarse.');
    }
    if (order.status === 'REJECTED') throw ApiError.conflict('La orden ya fue rechazada.');

    return purchaseOrderRepository.updateById(
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

module.exports = purchaseOrderService;
