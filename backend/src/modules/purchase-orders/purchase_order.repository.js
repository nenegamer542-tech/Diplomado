'use strict';

const BaseRepository = require('../../common/BaseRepository');
const PurchaseOrder = require('./purchase_order.model');

/** Repositorio de órdenes de compra — tenant: companyId obligatorio. */
class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super(PurchaseOrder, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }
}

module.exports = new PurchaseOrderRepository();
