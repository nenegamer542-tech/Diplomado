'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { nextSequence, formatCode } = require('../../common/sequence');
const productionOrderRepository = require('./production_order.repository');
const bomRepository = require('./bom.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const productRepository = require('../products/product.repository');
const inventoryService = require('../inventory/inventory.service');

/**
 * Servicio de ÓRDENES DE PRODUCCIÓN (FASE 6) — multiempresa estricto.
 *
 * Reglas (ADR-013):
 *  - companyId SALE SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - Flujo DRAFT → RELEASED → DONE | CANCELLED; sólo se edita en DRAFT;
 *    sin DELETE (la baja es por estado, ADR-012).
 *  - RELEASE: copia los componentes de la BOM escalados por `quantity`
 *    (snapshot en `lines`) y ejecuta una SALIDA por componente; si una línea
 *    posterior falla (stock insuficiente 409), se devuelven las ya extraídas
 *    y el estado NO cambia (compensaciones ADR-008).
 *  - DONE: ENTRADA del producto terminado; si el marcado final falla tras la
 *    entrada, se extrae de vuelta (compensación).
 *  - CANCELLED: desde DRAFT sólo cambia el estado; desde RELEASED devuelve
 *    los componentes (entradas) con motivo obligatorio; si el marcado falla,
 *    se reextraen (compensación).
 *  - `total` no aplica; `code` sale del contador atómico (MO-000001…, ADR-009).
 */
const CODE_KEY = 'production_orders';
const CODE_PREFIX = 'MO';

const round4 = (n) => Math.round(n * 10000) / 10000;

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

async function loadActiveBom(bomId, companyId) {
  const bom = await bomRepository.findById(bomId, { companyId });
  if (!bom) throw ApiError.notFound('Recurso no encontrado.');
  if (bom.status !== 'active') {
    throw ApiError.conflict('La lista de materiales está inactiva; no admite órdenes de producción.');
  }
  return bom;
}

async function loadActiveProduct(productId, companyId) {
  const product = await productRepository.findById(productId, { companyId });
  if (!product) throw ApiError.notFound('Recurso no encontrado.');
  if (product.status !== 'active') {
    throw ApiError.conflict('El producto está inactivo; no admite movimientos de inventario.');
  }
  return product;
}

/** Valida BOM + almacén + producto terminado (create/update/release). */
async function prepare(data, companyId) {
  const bom = await loadActiveBom(data.bomId, companyId);
  const warehouse = await resolveWarehouse(data.warehouseId, companyId);
  await loadActiveProduct(bom.productId, companyId);
  return { bomId: bom._id, warehouseId: warehouse._id, productId: bom.productId };
}

/**
 * Compensación genérica de asientos ya aplicados (mejor esfuerzo con log):
 * mode 'entry' devuelve material extraído; mode 'exit' reextrae material devuelto.
 */
async function compensate(lines, warehouseId, actor, code, mode, context) {
  for (const line of lines) {
    const operation = mode === 'entry' ? inventoryService.entry : inventoryService.exit;
    await operation(
      {
        productId: line.productId,
        warehouseId,
        quantity: line.quantity,
        traceability: line.traceability,
        reason: `Compensación de orden de producción ${code}`,
        reference: code,
      },
      actor
    ).catch((err) => logger.error({ err: err.message }, context));
  }
}

const productionOrderService = {
  async list(filter, options) {
    return productionOrderRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return productionOrderRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const prepared = await prepare(data, companyId);
    const seq = await nextSequence(companyId, CODE_KEY);

    return productionOrderRepository.create({
      companyId,
      code: formatCode(CODE_PREFIX, seq),
      status: 'DRAFT',
      quantity: data.quantity,
      lines: [],
      notes: data.notes || null,
      createdBy: userId || null,
      ...prepared,
    });
  },

  async update(id, data, companyId) {
    const order = await productionOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status !== 'DRAFT') {
      throw ApiError.conflict('Sólo los documentos en borrador pueden modificarse.');
    }

    const patch = {};
    if (data.bomId !== undefined || data.warehouseId !== undefined) {
      Object.assign(
        patch,
        await prepare(
          {
            bomId: data.bomId !== undefined ? data.bomId : order.bomId,
            warehouseId:
              data.warehouseId !== undefined ? data.warehouseId : String(order.warehouseId),
          },
          companyId
        )
      );
    }
    if (data.quantity !== undefined) patch.quantity = data.quantity;
    if (data.notes !== undefined) patch.notes = data.notes;

    return productionOrderRepository.updateById(id, patch, { companyId });
  },

  /** DRAFT → RELEASED: salidas de componentes escalados + snapshot en `lines`. */
  async release(id, companyId, userId, data = {}) {
    const order = await productionOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'RELEASED') throw ApiError.conflict('La orden ya fue liberada.');
    if (order.status === 'DONE') throw ApiError.conflict('La orden ya fue finalizada; no puede liberarse.');
    if (order.status === 'CANCELLED') {
      throw ApiError.conflict('La orden fue cancelada; no puede liberarse.');
    }

    // Revalida todo en el momento de liberar (podría haber cambiado).
    const bom = await loadActiveBom(order.bomId, companyId);
    const warehouse = await resolveWarehouse(String(order.warehouseId), companyId);
    await loadActiveProduct(order.productId, companyId);

    const supplied = data.components || [];
    const suppliedIds = supplied.map((component) => String(component.productId));
    if (new Set(suppliedIds).size !== suppliedIds.length) {
      throw ApiError.unprocessable('No repita componentes al proporcionar lotes o series.');
    }
    const bomProductIds = new Set(bom.components.map((component) => String(component.productId)));
    if (suppliedIds.some((productId) => !bomProductIds.has(productId))) {
      throw ApiError.unprocessable('La trazabilidad debe pertenecer a un componente de la lista de materiales.');
    }
    const suppliedByProduct = new Map(supplied.map((component) => [String(component.productId), component.traceability]));
    const lines = bom.components.map((c) => ({
      productId: c.productId,
      quantity: round4(c.quantity * order.quantity),
      ...(suppliedByProduct.has(String(c.productId))
        ? { traceability: suppliedByProduct.get(String(c.productId)) }
        : {}),
    }));

    const actor = { companyId, userId };
    const applied = [];
    try {
      for (const line of lines) {
        await inventoryService.exit(
          {
            productId: line.productId,
            warehouseId: warehouse._id,
            quantity: line.quantity,
            traceability: line.traceability,
            reason: `Liberación de orden de producción ${order.code}`,
            reference: order.code,
          },
          actor
        );
        applied.push(line);
      }
    } catch (err) {
      // Stock insuficiente en una línea posterior: devuelve las ya extraídas.
      await compensate(applied, warehouse._id, actor, order.code, 'entry', 'Compensación de liberación de OT falló');
      throw err;
    }

    try {
      const released = await productionOrderRepository.markReleased(
        id,
        { companyId },
        {
          status: 'RELEASED',
          lines,
          releasedBy: userId || null,
          releasedAt: new Date(),
        }
      );
      if (!released) {
        throw ApiError.conflict('La orden cambió de estado durante la operación. Intente de nuevo.');
      }
      return released;
    } catch (err) {
      await compensate(lines, warehouse._id, actor, order.code, 'entry', 'Compensación de liberación de OT falló');
      throw err;
    }
  },

  /** RELEASED → DONE: entrada del producto terminado. */
  async done(id, companyId, userId, data = {}) {
    const order = await productionOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'DONE') throw ApiError.conflict('La orden ya fue finalizada.');
    if (order.status === 'DRAFT') {
      throw ApiError.conflict('La orden debe estar liberada antes de finalizarse.');
    }
    if (order.status === 'CANCELLED') {
      throw ApiError.conflict('La orden fue cancelada; no puede finalizarse.');
    }

    const actor = { companyId, userId };
    const finished = [
      { productId: order.productId, quantity: order.quantity, traceability: data.traceability },
    ];

    // La entrada valida producto/almacén activos; si falla, no hay cambio de estado.
    await inventoryService.entry(
      {
        productId: order.productId,
        warehouseId: order.warehouseId,
        quantity: order.quantity,
        traceability: data.traceability,
        reason: `Finalización de orden de producción ${order.code}`,
        reference: order.code,
      },
      actor
    );

    try {
      const doneOrder = await productionOrderRepository.markDone(
        id,
        { companyId },
        { status: 'DONE', doneBy: userId || null, doneAt: new Date() }
      );
      if (!doneOrder) {
        throw ApiError.conflict('La orden cambió de estado durante la operación. Intente de nuevo.');
      }
      return doneOrder;
    } catch (err) {
      await compensate(finished, order.warehouseId, actor, order.code, 'exit', 'Compensación de finalización de OT falló');
      throw err;
    }
  },

  /** DRAFT|RELEASED → CANCELLED (motivo obligatorio; RELEASED devuelve material). */
  async cancel(id, data, companyId, userId) {
    const order = await productionOrderRepository.findById(id, { companyId });
    if (!order) throw ApiError.notFound('Recurso no encontrado.');
    if (order.status === 'DONE') throw ApiError.conflict('La orden finalizada no puede cancelarse.');
    if (order.status === 'CANCELLED') throw ApiError.conflict('La orden ya fue cancelada.');

    const actor = { companyId, userId };
    const markCancelled = () =>
      productionOrderRepository.markCancelled(
        id,
        { companyId },
        {
          status: 'CANCELLED',
          cancelledBy: userId || null,
          cancelledAt: new Date(),
          cancelReason: data.reason,
        }
      );

    if (order.status === 'RELEASED' && order.lines.length) {
      // Devuelve los componentes extraídos en RELEASE (entrada compensatoria).
      const applied = [];
      try {
        for (const line of order.lines) {
          await inventoryService.entry(
            {
              productId: line.productId,
              warehouseId: order.warehouseId,
        quantity: line.quantity,
        traceability: line.traceability,
              reason: `Cancelación de orden de producción ${order.code}`,
              reference: order.code,
            },
            actor
          );
          applied.push(line);
        }
      } catch (err) {
        await compensate(applied, order.warehouseId, actor, order.code, 'exit', 'Compensación de cancelación de OT falló');
        throw err;
      }

      try {
        const cancelled = await markCancelled();
        if (!cancelled) {
          throw ApiError.conflict('La orden cambió de estado durante la operación. Intente de nuevo.');
        }
        return cancelled;
      } catch (err) {
        await compensate(order.lines, order.warehouseId, actor, order.code, 'exit', 'Compensación de cancelación de OT falló');
        throw err;
      }
    }

    const cancelled = await markCancelled();
    if (!cancelled) {
      throw ApiError.conflict('La orden cambió de estado durante la operación. Intente de nuevo.');
    }
    return cancelled;
  },
};

module.exports = productionOrderService;
