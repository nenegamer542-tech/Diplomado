'use strict';

const BaseRepository = require('../../common/BaseRepository');
const SalesOrder = require('./sales_order.model');

/** Repositorio de pedidos de venta — tenant: companyId obligatorio. */
class SalesOrderRepository extends BaseRepository {
  constructor() {
    super(SalesOrder, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }
}

module.exports = new SalesOrderRepository();
