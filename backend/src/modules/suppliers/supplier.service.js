'use strict';

const ApiError = require('../../utils/ApiError');
const supplierRepository = require('./supplier.repository');
const purchaseOrderRepository = require('../purchase-orders/purchase_order.repository');

/**
 * Servicio de proveedores — multiempresa estricto: companyId SIEMPRE del token.
 * Un ID ajeno en la URL/body => 404 (nunca 403).
 */
const supplierService = {
  async list(filter, options) {
    return supplierRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return supplierRepository.findById(id, { companyId });
  },

  async create(data, companyId) {
    const code = String(data.code).toUpperCase();
    const existing = await supplierRepository.findByCode(companyId, code);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
    }
    return supplierRepository.create({ ...data, code, companyId });
  },

  async update(id, data, companyId) {
    const supplier = await supplierRepository.findById(id, { companyId });
    if (!supplier) throw ApiError.notFound('Recurso no encontrado.');

    const patch = { ...data };
    if (patch.code) {
      const code = String(patch.code).toUpperCase();
      const existing = await supplierRepository.findByCode(companyId, code);
      if (existing && String(existing._id) !== id) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
      }
      patch.code = code;
    }

    return supplierRepository.updateById(id, patch, { companyId });
  },

  /**
   * Borrado físico sólo si el proveedor nunca tuvo órdenes de compra.
   * Si no: 409 con mensaje de acción (desactivar en su lugar).
   */
  async remove(id, companyId) {
    const supplier = await supplierRepository.findById(id, { companyId });
    if (!supplier) throw ApiError.notFound('Recurso no encontrado.');

    const orders = await purchaseOrderRepository.exists({ companyId, supplierId: id });
    if (orders) {
      throw ApiError.conflict(
        'El proveedor tiene órdenes de compra: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
      );
    }

    return supplierRepository.deleteById(id, { companyId });
  },
};

module.exports = supplierService;
