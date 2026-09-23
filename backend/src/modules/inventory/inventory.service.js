'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const productRepository = require('../products/product.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const stockLevelRepository = require('./stock_level.repository');
const inventoryMovementRepository = require('./inventory_movement.repository');

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

    const updated = await stockLevelRepository.increment(key, quantity);

    try {
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
        userId: actor.userId || null,
      });
    } catch (err) {
      await stockLevelRepository.decrementConditional(key, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de entrada falló');
      });
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

    const source = await stockLevelRepository.decrementConditional(key, quantity);
    if (!source) throw await insufficientStock(companyId, warehouse._id, product._id);

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
        userId: actor.userId || null,
      });
    } catch (err) {
      await stockLevelRepository.increment(key, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de salida falló');
      });
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
    const warehouse = await loadActiveWarehouse(data.warehouseId, companyId);
    const target = data.quantity;
    const key = { companyId, warehouseId: warehouse._id, productId: product._id };

    const current = await stockLevelRepository.getOne(companyId, warehouse._id, product._id);
    const before = current ? current.quantity : 0;
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
    const sourceKey = { companyId, warehouseId: from._id, productId: product._id };
    const destKey = { companyId, warehouseId: to._id, productId: product._id };

    const sourceAfter = await stockLevelRepository.decrementConditional(sourceKey, quantity);
    if (!sourceAfter) throw await insufficientStock(companyId, from._id, product._id);

    let destAfter;
    try {
      destAfter = await stockLevelRepository.increment(destKey, quantity);
    } catch (err) {
      await stockLevelRepository.increment(sourceKey, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de transferencia (origen) falló');
      });
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
        userId: actor.userId || null,
      });
    } catch (err) {
      await stockLevelRepository.decrementConditional(destKey, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de transferencia (destino) falló');
      });
      await stockLevelRepository.increment(sourceKey, quantity).catch((compErr) => {
        logger.error({ err: compErr.message }, 'Compensación de transferencia (origen) falló');
      });
      throw err;
    }
  },
};

module.exports = inventoryService;
