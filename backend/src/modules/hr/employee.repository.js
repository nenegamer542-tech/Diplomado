'use strict';

const mongoose = require('mongoose');
const BaseRepository = require('../../common/BaseRepository');
const Employee = require('./employee.model');

/** Repositorio de empleados — tenant: companyId obligatorio (guardia Base). */
class EmployeeRepository extends BaseRepository {
  constructor() {
    super(Employee, { requireTenant: true });
  }

  /** Unicidad de documento por empresa (excluye el propio registro). */
  async existsByDocument(companyId, documentId, excludeId = null) {
    this._guard({ companyId });
    const filter = { companyId, documentId };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) filter._id = { $ne: excludeId };
    return this.model.exists(filter);
  }
}

module.exports = new EmployeeRepository();
