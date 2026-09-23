'use strict';

const ApiError = require('../../utils/ApiError');
const customerRepository = require('./customer.repository');
const salesOrderRepository = require('../sales-orders/sales_order.repository');

/**
 * Servicio de clientes — multiempresa estricto: companyId SIEMPRE del token.
 * Un ID ajeno en la URL/body => 404 (nunca 403).
 */
const customerService = {
  async list(filter, options) {
    return customerRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return customerRepository.findById(id, { companyId });
  },

  async create(data, companyId) {
    const code = String(data.code).toUpperCase();
    const existing = await customerRepository.findByCode(companyId, code);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
    }
    return customerRepository.create({ ...data, code, companyId });
  },

  async update(id, data, companyId) {
    const customer = await customerRepository.findById(id, { companyId });
    if (!customer) throw ApiError.notFound('Recurso no encontrado.');

    const patch = { ...data };
    if (patch.code) {
      const code = String(patch.code).toUpperCase();
      const existing = await customerRepository.findByCode(companyId, code);
      if (existing && String(existing._id) !== id) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
      }
      patch.code = code;
    }

    return customerRepository.updateById(id, patch, { companyId });
  },

  /**
   * Borrado físico sólo si el cliente nunca tuvo pedidos de venta.
   * Si no: 409 con mensaje de acción (desactivar en su lugar).
   */
  async remove(id, companyId) {
    const customer = await customerRepository.findById(id, { companyId });
    if (!customer) throw ApiError.notFound('Recurso no encontrado.');

    const orders = await salesOrderRepository.exists({ companyId, customerId: id });
    if (orders) {
      throw ApiError.conflict(
        'El cliente tiene pedidos de venta: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
      );
    }

    return customerRepository.deleteById(id, { companyId });
  },
};

module.exports = customerService;
