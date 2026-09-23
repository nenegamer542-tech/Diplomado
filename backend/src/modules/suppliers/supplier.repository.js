'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Supplier = require('./supplier.model');

/** Repositorio de proveedores — tenant: companyId obligatorio (guardia Base). */
class SupplierRepository extends BaseRepository {
  constructor() {
    super(Supplier, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }
}

module.exports = new SupplierRepository();
