'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Customer = require('./customer.model');

/** Repositorio de clientes — tenant: companyId obligatorio (guardia Base). */
class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }
}

module.exports = new CustomerRepository();
