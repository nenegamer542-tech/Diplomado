'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const productRepository = require('../products/product.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const stockLevelRepository = require('./stock_level.repository');
const inventoryMovementRepository = require('./inventory_movement.repository');
const Product = require('../products/product.model');
const StockLevel = require('./stock_level.model');
const mongoose = require('mongoose');
const inventoryTraceRepository = require('./inventory_trace.repository');

/**
 * Servicio de INVENTARIO (FASE 3) — multiempresa estricto.
 *
 * Reglas:
 *  - companyId SALE SIEMPRE del token; un ID ajeno en el body => 404 (no 403).
 *  - Salidas y origen de transferencias usan decremento CONDICIONAL atómico
 *    ({ quantity: { $gte } }): dos salidas simultáneas nunca dejan stock
 *    negativo; sólo una gana y la otra recibe 409 "Stock insuficiente".
 *  - Ajustes = recuento absoluto con condición de valor esperado (optimista):
 *    si el stock cambió en medio, 409 y se reintenta.
 *  - Si el registro del movimiento falla tras mover stock, se COMPENSA con la
 *    operación inversa (mantiene el invariante quantity >= 0).
 *  - Los movimientos se crean aquí y no se editan ni se borran.
 */

const sameId = (a, b) => String(a) === String(b);

function requireCompany(actor) {
  if (!actor?.companyId) {
    throw ApiError.forbidden('Operación disponible sólo en contexto de empresa.');
  }
  return actor.companyId;
}

function trackingMode(product) {
  return product.trackingMode || 'none';
}

async function loadActiveProduct(productId, companyId) {
  const product = await productRepository.findById(productId, { companyId });
  if (!product) throw ApiError.notFound('Recurso no encontrado.');
  if (product.status !== 'active') {
    throw ApiError.conflict('El producto está inactivo; no admite movimientos de inventario.');
  }
  return product;
}

async function loadActiveWarehouse(warehouseId, companyId) {
  const warehouse = await warehouseRepository.findById(warehouseId, { companyId });
  if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
  if (warehouse.status !== 'active') {
    throw ApiError.conflict('El almacén está inactivo; no admite movimientos de inventario.');
  }
  return warehouse;
}

function validateTraceability(product, data) {
  const traceability = data.traceability;
  const mode = trackingMode(product);
  if (mode === 'none') {
    if (traceability) throw ApiError.unprocessable('Este producto no utiliza lote ni serie.');
    return [];
  }
  if (!Array.isArray(traceability) || !traceability.length) {
    throw ApiError.unprocessable('Debe indicar lotes o series para este producto.');
  }
  const identifiers = traceability.map((item) => item.identifier.trim().toUpperCase());
  if (new Set(identifiers).size !== identifiers.length) {
    throw ApiError.unprocessable('No repita identificadores de lote/serie en un movimiento.');
  }
  const normalized = traceability.map((item, index) => ({ ...item, identifier: identifiers[index] }));
  if (mode === 'lot') {
    const total = normalized.reduce((sum, item) => sum + item.quantity, 0);
    if (Math.abs(total - data.quantity) > 1e-8) {
      throw ApiError.unprocessable('La suma de cantidades por lote debe coincidir con la cantidad del movimiento.');
    }
  } else if (!Number.isInteger(data.quantity) || normalized.length !== data.quantity || normalized.some((item) => item.quantity !== 1)) {
    throw ApiError.unprocessable('Para productos seriados indique una serie única por unidad.');
  }
  return normalized;
}

async function addTrackedStock(product, companyId, warehouseId, items) {
  const applied = [];
  try {
    for (const item of items) {
      if (trackingMode(product) === 'lot') {
        await inventoryTraceRepository.increaseLot(
          { companyId, productId: product._id, warehouseId, identifier: item.identifier, expiryDate: item.expiryDate },
          item.quantity
        );
        applied.push(item);
        continue;
      }
      const existing = await inventoryTraceRepository.findByIdentifier(companyId, product._id, item.identifier);
      if (existing?.quantity > 0) throw ApiError.conflict(`La serie ${item.identifier} ya está disponible en inventario.`);
      if (existing) {
        const serial = await inventoryTraceRepository.reactivateSerial(companyId, product._id, warehouseId, item.identifier);
        if (!serial) throw ApiError.conflict(`La serie ${item.identifier} cambió durante la operación.`);
        applied.push({ ...item, reactivated: true, previousWarehouseId: existing.warehouseId });
      } else {
        const serial = await inventoryTraceRepository.createSerial({ companyId, productId: product._id, warehouseId, identifier: item.identifier });
        applied.push({ ...item, traceId: serial._id });
      }
    }
    return applied;
  } catch (err) {
    await reverseTrackedEntry(product, companyId, warehouseId, applied);
    if (err?.code === 11000) throw ApiError.conflict('El lote o la serie ya existe en inventario.');
    throw err;
  }
}

async function reverseTrackedEntry(product, companyId, warehouseId, items) {
  for (const item of [...items].reverse()) {
    if (product.trackingMode === 'lot') {
      await inventoryTraceRepository.decrementLot(companyId, product._id, warehouseId, item.identifier, item.quantity);
    } else {
      await inventoryTraceRepository.deactivateSerial(companyId, product._id, warehouseId, item.identifier);
      if (item.reactivated && item.previousWarehouseId) {
        await inventoryTraceRepository.restoreSerialLocation(
          companyId,
          product._id,
          warehouseId,
          item.previousWarehouseId,
          item.identifier
        );
      }
    }
  }
}

async function takeTrackedStock(product, companyId, warehouseId, items) {
  const applied = [];
  try {
    for (const item of items) {
      const changed = trackingMode(product) === 'lot'
        ? await inventoryTraceRepository.decrementLot(companyId, product._id, warehouseId, item.identifier, item.quantity)
        : await inventoryTraceRepository.deactivateSerial(companyId, product._id, warehouseId, item.identifier);
      if (!changed) throw ApiError.conflict(`Cantidad insuficiente o identificador no disponible: ${item.identifier}.`);
      applied.push(item);
    }
    return applied;
  } catch (err) {
    await restoreTrackedStock(product, companyId, warehouseId, applied);
    throw err;
  }
}

async function restoreTrackedStock(product, companyId, warehouseId, items) {
  for (const item of items) {
    if (trackingMode(product) === 'lot') {
      await inventoryTraceRepository.increaseLot(
        { companyId, productId: product._id, warehouseId, identifier: item.identifier, expiryDate: item.expiryDate },
        item.quantity
      );
    } else {
      await inventoryTraceRepository.reactivateSerial(companyId, product._id, warehouseId, item.identifier);
    }
  }
}

async function insufficientStock(companyId, warehouseId, productId) {
  const current = await stockLevelRepository.getOne(companyId, warehouseId, productId);
  return ApiError.conflict('Stock insuficiente en el almacén indicado.', {
    available: current ? current.quantity : 0,
  });
}

function uniqueValues(items, field) {
  const seen = new Map();
  for (const item of items) seen.set(String(item[field]), item[field]);
  return [...seen.values()];
}

/** Añade { product, warehouse } (resumen) a las filas de stock. */
async function hydrateStock(items, companyId) {
  if (!items.length) return items;
  const [products, warehouses] = await Promise.all([
    productRepository.findAll(
      { companyId, _id: { $in: uniqueValues(items, 'productId') } },
      { projection: 'sku name unit' }
    ),
    warehouseRepository.findAll(
      { companyId, _id: { $in: uniqueValues(items, 'warehouseId') } },
      { projection: 'code name' }
    ),
  ]);
  const pMap = new Map(products.map((p) => [String(p._id), { sku: p.sku, name: p.name, unit: p.unit }]));
  const wMap = new Map(warehouses.map((w) => [String(w._id), { code: w.code, name: w.name }]));

  return items.map((i) => ({
    ...i,
    product: pMap.get(String(i.productId)) || null,
    warehouse: wMap.get(String(i.warehouseId)) || null,
  }));
}

/** Añade { product, warehouse, toWarehouse } (resumen) a los movimientos. */
async function hydrateMovements(items, companyId) {
  if (!items.length) return items;
  const toIds = uniqueValues(
    items.filter((i) => i.toWarehouseId),
    'toWarehouseId'
  );
  const warehouseIds = [...uniqueValues(items, 'warehouseId'), ...toIds];
  const [products, warehouses] = await Promise.all([
    productRepository.findAll(
      { companyId, _id: { $in: uniqueValues(items, 'productId') } },
      { projection: 'sku name unit' }
    ),
    warehouseRepository.findAll(
      { companyId, _id: { $in: warehouseIds } },
      { projection: 'code name' }
    ),
  ]);
  const pMap = new Map(products.map((p) => [String(p._id), { sku: p.sku, name: p.name, unit: p.unit }]));
  const wMap = new Map(warehouses.map((w) => [String(w._id), { code: w.code, name: w.name }]));

  return items.map((i) => ({
    ...i,
    product: pMap.get(String(i.productId)) || null,
    warehouse: wMap.get(String(i.warehouseId)) || null,
    toWarehouse: i.toWarehouseId ? wMap.get(String(i.toWarehouseId)) || null : null,
  }));
}

const inventoryService = {
  async listStock(filter, options) {
    const { items, total } = await stockLevelRepository.find(filter, options);
    return { items: await hydrateStock(items, filter.companyId), total };
  },

  async listMovements(filter, options) {
    const { items, total } = await inventoryMovementRepository.find(filter, options);
    return { items: await hydrateMovements(items, filter.companyId), total };
  },

  async listTraceability(companyId, { productId, warehouseId, kind }) {
    const product = await productRepository.findById(productId, { companyId });
    if (!product) throw ApiError.notFound('Recurso no encontrado.');
    const filter = { quantity: { $gt: 0 } };
    if (warehouseId) filter.warehouseId = warehouseId;
    if (kind) filter.kind = kind;
    return inventoryTraceRepository.listForProduct(companyId, product._id, filter);
  },

  async listAlerts(companyId, { skip = 0, limit = 20 } = {}) {
    const tenantId = new mongoose.Types.ObjectId(companyId);
    const [result] = await Product.aggregate([
      { $match: { companyId: tenantId, status: 'active' } },
      {
        $lookup: {
          from: StockLevel.collection.name,
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$companyId', tenantId] },
                    { $eq: ['$productId', '$$productId'] },
                  ],
                },
              },
            },
            { $group: { _id: null, quantity: { $sum: '$quantity' } } },
          ],
          as: 'stockSummary',
        },
      },
      { $set: { currentStock: { $ifNull: [{ $arrayElemAt: ['$stockSummary.quantity', 0] }, 0] } } },
      {
        $set: {
          alertType: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $gt: ['$minStock', 0] }, { $lte: ['$currentStock', '$minStock'] }],
                  },
                  then: 'LOW_STOCK',
                },
                {
                  case: {
                    $and: [{ $ne: ['$maxStock', null] }, { $gte: ['$currentStock', '$maxStock'] }],
                  },
                  then: 'OVER_MAXIMUM',
                },
              ],
              default: null,
            },
          },
        },
      },
      { $match: { alertType: { $ne: null } } },
      {
        $project: {
          _id: 1,
          sku: 1,
          name: 1,
          unit: 1,
          minStock: 1,
          maxStock: 1,
          currentStock: 1,
          alertType: 1,
        },
      },
      {
        $facet: {
          items: [{ $sort: { sku: 1 } }, { $skip: skip }, { $limit: limit }],
          total: [{ $count: 'value' }],
        },
      },
    ]);
    return { items: result?.items || [], total: result?.total?.[0]?.value || 0 };
  },

  async getMovement(id, companyId) {
    const movement = await inventoryMovementRepository.findById(id, { companyId });
    if (!movement) return null;
    return (await hydrateMovements([movement], companyId))[0];
  },

  /** ENTRADA: upsert + $inc; si el movimiento falla, se descuenta (compensación). */
  async entry(data, actor) {
    const companyId = requireCompany(actor);
    const product = await loadActiveProduct(data.productId, companyId);
    const warehouse = await loadActiveWarehouse(data.warehouseId, companyId);
    const quantity = data.quantity;
    const key = { companyId, warehouseId: warehouse._id, productId: product._id };

    const traceability = validateTraceability(product, data);
    const tracked = trackingMode(product) !== 'none';
    const appliedTrace = tracked ? await addTrackedStock(product, companyId, warehouse._id, traceability) : [];
    let updated = null;

    try {
      updated = await stockLevelRepository.increment(key, quantity);
      return await inventoryMovementRepository.create({
        companyId,
        type: 'ENTRY',
        productId: product._id,
        warehouseId: warehouse._id,
        quantity,
        delta: quantity,
        quantityBefore: updated.quantity - quantity,
        quantityAfter: updated.quantity,
        reason: data.reason || null,
        reference: data.reference || null,
        traceability,
        userId: actor.userId || null,
      });
    } catch (err) {
      if (updated) await stockLevelRepository.decrementConditional(key, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de entrada falló');
      });
      if (tracked) await reverseTrackedEntry(product, companyId, warehouse._id, appliedTrace);
      throw err;
    }
  },

  /** SALIDA: decremento condicional atómico; compensación si el movimiento falla. */
  async exit(data, actor) {
    const companyId = requireCompany(actor);
    const product = await loadActiveProduct(data.productId, companyId);
    const warehouse = await loadActiveWarehouse(data.warehouseId, companyId);
    const quantity = data.quantity;
    const key = { companyId, warehouseId: warehouse._id, productId: product._id };

    const traceability = validateTraceability(product, data);
    const tracked = trackingMode(product) !== 'none';
    const appliedTrace = tracked ? await takeTrackedStock(product, companyId, warehouse._id, traceability) : [];
    const source = await stockLevelRepository.decrementConditional(key, quantity);
    if (!source) {
      if (tracked) await restoreTrackedStock(product, companyId, warehouse._id, appliedTrace);
      throw await insufficientStock(companyId, warehouse._id, product._id);
    }

    try {
      return await inventoryMovementRepository.create({
        companyId,
        type: 'EXIT',
        productId: product._id,
        warehouseId: warehouse._id,
        quantity,
        delta: -quantity,
        quantityBefore: source.quantity + quantity,
        quantityAfter: source.quantity,
        reason: data.reason || null,
        reference: data.reference || null,
        traceability,
        userId: actor.userId || null,
      });
    } catch (err) {
      await stockLevelRepository.increment(key, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de salida falló');
      });
      if (tracked) await restoreTrackedStock(product, companyId, warehouse._id, appliedTrace);
      throw err;
    }
  },

  /**
   * AJUSTE: fija el recuento absoluto con condición de valor esperado.
   * `reason` es obligatorio (validación Zod) para trazabilidad.
   */
  async adjustment(data, actor) {
    const companyId = requireCompany(actor);
    const product = await loadActiveProduct(data.productId, companyId);
    if (trackingMode(product) !== 'none') {
      throw ApiError.conflict('Tracked products must be adjusted through a traceable physical count.');
    }
    const warehouse = await loadActiveWarehouse(data.warehouseId, companyId);
    const target = data.quantity;
    const key = { companyId, warehouseId: warehouse._id, productId: product._id };

    const current = await stockLevelRepository.getOne(companyId, warehouse._id, product._id);
    const before = current ? current.quantity : 0;
    if (data.expectedQuantity !== undefined && before !== data.expectedQuantity) {
      throw ApiError.conflict('El stock cambió desde que se inició el inventario físico. Vuelva a contar el producto.');
    }
    const delta = target - before;

    let afterDoc = null;
    if (current) {
      afterDoc = await stockLevelRepository.setExact(key, before, target);
      if (!afterDoc) {
        throw ApiError.conflict('El stock cambió durante la operación. Intente de nuevo.');
      }
    } else if (target > 0) {
      afterDoc = await stockLevelRepository.createIfAbsent({ ...key, quantity: target });
      if (!afterDoc) {
        throw ApiError.conflict('El stock cambió durante la operación. Intente de nuevo.');
      }
    }
    // Sin fila y target 0: no se crea registro (agotado = fila ausente o 0).

    try {
      return await inventoryMovementRepository.create({
        companyId,
        type: 'ADJUSTMENT',
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: target,
        delta,
        quantityBefore: before,
        quantityAfter: target,
        reason: data.reason,
        reference: data.reference || null,
        idempotencyKey: data.idempotencyKey || null,
        userId: actor.userId || null,
      });
    } catch (err) {
      // Compensación del ajuste: restaurar el valor anterior.
      if (current) {
        await stockLevelRepository.setExact(key, target, before).catch((compErr) => {
          logger.error({ err: compErr.message }, 'Compensación de ajuste falló');
        });
      } else if (afterDoc) {
        await stockLevelRepository.deleteById(afterDoc._id, { companyId }).catch((compErr) => {
          logger.error({ err: compErr.message }, 'Compensación de ajuste (borrado) falló');
        });
      }
      throw err;
    }
  },

  /**
   * TRANSFERENCIA: decremento condicional en ORIGEN + incremento en DESTINO
   * con compensación en cascada si algún paso posterior falla.
   */
  async transfer(data, actor) {
    const companyId = requireCompany(actor);
    const product = await loadActiveProduct(data.productId, companyId);
    const from = await loadActiveWarehouse(data.fromWarehouseId, companyId);
    const to = await loadActiveWarehouse(data.toWarehouseId, companyId);
    if (sameId(from._id, to._id)) {
      throw ApiError.unprocessable('Los almacenes de origen y destino deben ser distintos.', [
        { field: 'toWarehouseId', message: 'Debe ser distinto del almacén de origen.' },
      ]);
    }
    const quantity = data.quantity;
    const traceability = validateTraceability(product, data);
    const tracked = trackingMode(product) !== 'none';
    const appliedTrace = tracked ? await takeTrackedStock(product, companyId, from._id, traceability) : [];
    const sourceKey = { companyId, warehouseId: from._id, productId: product._id };
    const destKey = { companyId, warehouseId: to._id, productId: product._id };

    const sourceAfter = await stockLevelRepository.decrementConditional(sourceKey, quantity);
    if (!sourceAfter) {
      if (tracked) await restoreTrackedStock(product, companyId, from._id, appliedTrace);
      throw await insufficientStock(companyId, from._id, product._id);
    }

    let destAfter;
    let destTraces = [];
    try {
      destAfter = await stockLevelRepository.increment(destKey, quantity);
      if (tracked) destTraces = await addTrackedStock(product, companyId, to._id, traceability);
    } catch (err) {
      if (destAfter) await stockLevelRepository.decrementConditional(destKey, quantity);
      await stockLevelRepository.increment(sourceKey, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de transferencia (origen) falló');
      });
      if (tracked) await restoreTrackedStock(product, companyId, from._id, appliedTrace);
      throw err;
    }

    try {
      return await inventoryMovementRepository.create({
        companyId,
        type: 'TRANSFER',
        productId: product._id,
        warehouseId: from._id,
        toWarehouseId: to._id,
        quantity,
        delta: -quantity,
        quantityBefore: sourceAfter.quantity + quantity,
        quantityAfter: sourceAfter.quantity,
        reason: data.reason || null,
        reference: data.reference || null,
        traceability,
        userId: actor.userId || null,
      });
    } catch (err) {
      await stockLevelRepository.decrementConditional(destKey, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de transferencia (destino) falló');
      });
      await stockLevelRepository.increment(sourceKey, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de transferencia (origen) falló');
      });
      if (tracked) {
        await takeTrackedStock(product, companyId, to._id, destTraces);
        await restoreTrackedStock(product, companyId, from._id, appliedTrace);
      }
      throw err;
    }
  },
};

module.exports = inventoryService;
