'use strict';

const ApiError = require('../../utils/ApiError');
const repository = require('./master_data.repository');
const Product = require('../products/product.model');
const Company = require('../companies/company.model');
const Account = require('../accounts/account.model');

const TYPE_BY_ROUTE = {
  categories: 'category',
  brands: 'brand',
  units: 'unit',
  currencies: 'currency',
  taxes: 'tax',
};

const REFERENCE_FIELDS = {
  category: ['categoryId'],
  brand: ['brandId'],
  unit: ['unitId'],
  tax: ['taxId'],
};

const service = {
  typeForRoute(routeType) {
    return TYPE_BY_ROUTE[routeType];
  },

  async list(routeType, filter, options) {
    return repository.find({ ...filter, type: TYPE_BY_ROUTE[routeType] }, options);
  },

  async getById(routeType, id, companyId) {
    const doc = await repository.findById(id, { companyId });
    return doc?.type === TYPE_BY_ROUTE[routeType] ? doc : null;
  },

  async create(routeType, data, companyId) {
    const type = TYPE_BY_ROUTE[routeType];
    const code = data.code.toUpperCase();
    if (await repository.findByCode(companyId, type, code)) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
    }
    const record = { ...data, code, type, companyId };
    if (type === 'unit') {
      record.decimalPlaces ??= record.allowFractions === false ? 0 : 3;
      record.allowFractions ??= true;
    }
    if (type === 'currency') {
      record.decimalPlaces ??= 2;
      record.symbol ??= code;
    }
    return repository.create(record);
  },

  async update(routeType, id, data, companyId) {
    const current = await repository.findById(id, { companyId });
    if (!current || current.type !== TYPE_BY_ROUTE[routeType]) {
      throw ApiError.notFound('Recurso no encontrado.');
    }
    const patch = { ...data };
    if (patch.code) {
      patch.code = patch.code.toUpperCase();
      const duplicate = await repository.findByCode(companyId, current.type, patch.code);
      if (duplicate && String(duplicate._id) !== String(id)) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
      }
    }
    const updated = await repository.updateById(id, patch, { companyId });
    // Los snapshots heredados siguen sincronizados con el catálogo canónico.
    const snapshotField = { category: 'category', brand: 'brand', unit: 'unit', tax: 'taxRate' }[current.type];
    if (snapshotField && (patch.name || patch.symbol || Object.hasOwn(patch, 'rate'))) {
      const value = current.type === 'unit' ? updated.symbol : current.type === 'tax' ? updated.rate : updated.name;
      await Product.updateMany({ companyId, [`${current.type}Id`]: id }, { $set: { [snapshotField]: value } });
    }
    if (current.type === 'currency' && patch.code) {
      await Promise.all([
        Company.updateMany({ currencyId: id }, { $set: { currency: updated.code } }),
        Account.updateMany({ companyId, currencyId: id }, { $set: { currency: updated.code } }),
      ]);
    }
    return updated;
  },

  async remove(routeType, id, companyId) {
    const current = await repository.findById(id, { companyId });
    if (!current || current.type !== TYPE_BY_ROUTE[routeType]) {
      throw ApiError.notFound('Recurso no encontrado.');
    }
    let inUse = false;
    for (const field of REFERENCE_FIELDS[current.type] || []) {
      inUse ||= Boolean(await Product.exists({ companyId, [field]: id }));
    }
    if (current.type === 'currency') {
      inUse = Boolean(
        (await Company.exists({ currencyId: id })) || (await Account.exists({ currencyId: id }))
      );
    }
    if (inUse) {
      throw ApiError.conflict('El dato maestro está en uso; desactívelo en lugar de eliminarlo.');
    }
    return repository.deleteById(id, { companyId });
  },
};

module.exports = service;
