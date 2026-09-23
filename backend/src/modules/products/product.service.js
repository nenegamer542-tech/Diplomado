'use strict';

const ApiError = require('../../utils/ApiError');
const productRepository = require('./product.repository');
const stockLevelRepository = require('../inventory/stock_level.repository');
const inventoryMovementRepository = require('../inventory/inventory_movement.repository');

/**
 * Servicio de productos — multiempresa estricto: companyId SIEMPRE del token.
 * Un ID ajeno en la URL/body => 404 (nunca 403).
 */
const productService = {
  async list(filter, options) {
    return productRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return productRepository.findById(id, { companyId });
  },

  async create(data, companyId) {
    const sku = String(data.sku).toUpperCase();
    const existing = await productRepository.findBySku(companyId, sku);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: sku.', { fields: ['sku'] });
    }
    return productRepository.create({ ...data, sku, companyId });
  },

  async update(id, data, companyId) {
    const product = await productRepository.findById(id, { companyId });
    if (!product) throw ApiError.notFound('Recurso no encontrado.');

    const patch = { ...data };
    if (patch.sku) {
      const sku = String(patch.sku).toUpperCase();
      const existing = await productRepository.findBySku(companyId, sku);
      if (existing && String(existing._id) !== id) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: sku.', { fields: ['sku'] });
      }
      patch.sku = sku;
    }

    return productRepository.updateById(id, patch, { companyId });
  },

  /**
   * Borrado físico sólo si el producto nunca tuvo existencias ni movimientos.
   * Si no: 409 con mensaje de acción (desactivar en su lugar).
   */
  async remove(id, companyId) {
    const product = await productRepository.findById(id, { companyId });
    if (!product) throw ApiError.notFound('Recurso no encontrado.');

    const withStock = await stockLevelRepository.hasStockForProduct(companyId, id);
    if (withStock) {
      throw ApiError.conflict(
        'El producto tiene existencias en almacenes: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
      );
    }

    const movements = await inventoryMovementRepository.exists({ companyId, productId: id });
    if (movements) {
      throw ApiError.conflict(
        'El producto tiene movimientos de inventario: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
      );
    }

    return productRepository.deleteById(id, { companyId });
  },
};

module.exports = productService;
