'use strict';

const mongoose = require('mongoose');
const BaseRepository = require('../../common/BaseRepository');
const Income = require('./income.model');

/** Repositorio de ingresos — tenant: companyId obligatorio (guardia Base). */
class IncomeRepository extends BaseRepository {
  constructor() {
    super(Income, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }

  /** Anulación condicional: sólo si sigue POSTED (la carrera la pierde el segundo). */
  async markVoided(id, { companyId }, fields) {
    this._guard({ companyId });
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return this.model
      .findOneAndUpdate(
        { _id: id, companyId, status: 'POSTED' },
        { $set: { ...fields, status: 'VOID' } },
        { new: true, runValidators: true }
      )
      .lean();
  }

  /** Relee el documento tras la anulación (devuelve el estado final). */
  async getByIdSafe(id, companyId) {
    return this.findById(id, { companyId });
  }
}

module.exports = new IncomeRepository();
