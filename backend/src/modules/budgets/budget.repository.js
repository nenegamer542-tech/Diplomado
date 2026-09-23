'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Budget = require('./budget.model');

/** Repositorio de presupuestos — tenant: companyId obligatorio (guardia Base). */
class BudgetRepository extends BaseRepository {
  constructor() {
    super(Budget, { requireTenant: true });
  }

  /** Clave única del presupuesto: (empresa, año, mes, categoría). */
  async findByKey(companyId, { year, month, category }) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, year, month, category }).lean();
  }
}

module.exports = new BudgetRepository();
