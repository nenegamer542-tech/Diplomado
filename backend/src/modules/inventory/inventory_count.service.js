'use strict';

const ApiError = require('../../utils/ApiError');
const repository = require('./inventory_count.repository');
const movementRepository = require('./inventory_movement.repository');
const stockRepository = require('./stock_level.repository');
const productRepository = require('../products/product.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const inventoryService = require('./inventory.service');
const inventoryTraceRepository = require('./inventory_trace.repository');
const { nextSequence, formatCode } = require('../../common/sequence');

const service = {
  list(filter, options) {
    return repository.find(filter, options);
  },

  getById(id, companyId) {
    return repository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const warehouse = await warehouseRepository.findById(data.warehouseId, { companyId });
    if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
    if (warehouse.status !== 'active') throw ApiError.conflict('El almacén está inactivo.');

    const lines = [];
    for (const line of data.lines) {
      const product = await productRepository.findById(line.productId, { companyId });
      if (!product) throw ApiError.notFound('Recurso no encontrado.');
      if (product.status !== 'active') throw ApiError.conflict('El producto está inactivo.');
      const stock = await stockRepository.getOne(companyId, warehouse._id, product._id);
      const trackingMode = product.trackingMode || 'none';
      const expectedTraceability = trackingMode === 'none' ? [] : await inventoryTraceRepository.listForProduct(
        companyId, product._id, { warehouseId: warehouse._id, quantity: { $gt: 0 } }
      );
      const countedTraceability = normalizeTraceability(line.traceability || []);
      validateCountedTraceability(trackingMode, line.countedQuantity, countedTraceability);
      lines.push({
        productId: product._id,
        expectedQuantity: stock?.quantity || 0,
        countedQuantity: line.countedQuantity,
        expectedTraceability: expectedTraceability.map(({ identifier, quantity, expiryDate }) => ({ identifier, quantity, expiryDate })),
        countedTraceability,
      });
    }

    const sequence = await nextSequence(companyId, 'inventory_counts');
    return repository.create({
      companyId,
      code: formatCode('IC', sequence),
      warehouseId: warehouse._id,
      status: 'DRAFT',
      lines,
      createdBy: userId || null,
    });
  },

  async post(id, companyId, userId) {
    const existing = await repository.findById(id, { companyId });
    if (!existing) throw ApiError.notFound('Recurso no encontrado.');
    if (existing.status === 'POSTED') throw ApiError.conflict('El inventario físico ya fue aplicado.');
    const count = await repository.claimPosting(id, companyId, new Date(Date.now() - 5 * 60 * 1000));
    if (!count) throw ApiError.conflict('El conteo está siendo procesado o no admite aplicación.');

    try {
      for (const line of count.lines) {
        if (line.applied) continue;
        const reference = `${count.code}:${line._id}`;
        const idempotencyKey = `count:${count._id}:${line._id}`;
        const previous = await movementRepository.findByIdempotencyKey(companyId, idempotencyKey);
        if (previous) {
          line.applied = true;
          line.movementId = previous._id;
          await count.save();
          continue;
        }

        const movement = await inventoryService.adjustment({
            productId: line.productId,
            warehouseId: count.warehouseId,
            quantity: line.countedQuantity,
            expectedQuantity: line.expectedQuantity,
            expectedTraceability: line.expectedTraceability,
            traceability: line.countedTraceability,
            reason: `Inventario físico ${count.code}`,
            reference,
            idempotencyKey,
          }, { companyId, userId });
        if (movement) line.movementId = movement._id;
        line.applied = true;
        await count.save();
      }
      count.status = 'POSTED';
      count.postedBy = userId || null;
      count.postedAt = new Date();
      return await count.save();
    } catch (err) {
      await repository.updateById(id, { status: 'PARTIAL' }, { companyId });
      throw err;
    }
  },
};

function normalizeTraceability(items) {
  return items.map((item) => ({
    identifier: item.identifier.trim().toUpperCase(),
    quantity: item.quantity,
    ...(item.expiryDate ? { expiryDate: item.expiryDate } : {}),
  }));
}

function validateCountedTraceability(mode, countedQuantity, items) {
  if (mode === 'none') {
    if (items.length) throw ApiError.unprocessable('Este producto no utiliza lote ni serie.');
    return;
  }
  if (mode === 'lot') {
    if (items.some((item) => item.quantity <= 0)) throw ApiError.unprocessable('Cada lote contado debe tener cantidad mayor que cero.');
    if (new Set(items.map((item) => item.identifier)).size !== items.length) throw ApiError.unprocessable('No repita lotes en una línea de conteo.');
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    if (Math.abs(total - countedQuantity) > 1e-8) throw ApiError.unprocessable('La suma de los lotes debe coincidir con la cantidad contada.');
    return;
  }
  if (mode === 'serial') {
    if (!Number.isInteger(countedQuantity) || items.length !== countedQuantity || items.some((item) => item.quantity !== 1)) {
      throw ApiError.unprocessable('Indique una serie única por cada unidad contada.');
    }
    if (new Set(items.map((item) => item.identifier)).size !== items.length) throw ApiError.unprocessable('No repita series en una línea de conteo.');
  }
}

module.exports = service;
