'use strict';

const mongoose = require('mongoose');
const BaseRepository = require('../../common/BaseRepository');
const ProductionOrder = require('./production_order.model');

/** Repositorio de órdenes de producción — tenant: companyId obligatorio. */
class ProductionOrderRepository extends BaseRepository {
  constructor() {
    super(ProductionOrder, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }

  _transition(id, condition, fields) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return this.model
      .findOneAndUpdate(
        { ...condition, _id: id },
        { $set: fields },
        { new: true, runValidators: true }
      )
      .lean();
  }

  /** DRAFT → RELEASED: escribe el snapshot de componentes en la misma operación. */
  async markReleased(id, { companyId }, fields) {
    this._guard({ companyId });
    return this._transition(id, { _id: id, companyId, status: 'DRAFT' }, fields);
  }

  /** RELEASED → DONE. */
  async markDone(id, { companyId }, fields) {
    this._guard({ companyId });
    return this._transition(id, { _id: id, companyId, status: 'RELEASED' }, fields);
  }

  /** DRAFT|RELEASED → CANCELLED (la carrera la pierde el segundo). */
  async markCancelled(id, { companyId }, fields) {
    this._guard({ companyId });
    return this._transition(
      id,
      { _id: id, companyId, status: { $in: ['DRAFT', 'RELEASED'] } },
      fields
    );
  }
}

module.exports = new ProductionOrderRepository();
