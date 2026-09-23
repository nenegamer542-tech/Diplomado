'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Branch = require('./branch.model');

/**
 * Repositorio de SUCURSALES.
 * requireTenant=true: el guard de BaseRepository exige companyId en CADA
 * query — imposible consultar sucursales de otra empresa por olvido.
 */
class BranchRepository extends BaseRepository {
  constructor() {
    super(Branch, { requireTenant: true });
  }

  async findDefault(companyId) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, isDefault: true }).lean();
  }

  /** Desmarca isDefault en las demás sucursales de la empresa. */
  async clearDefault(companyId, exceptId = null) {
    this._guard({ companyId });
    const filter = exceptId ? { companyId, _id: { $ne: exceptId } } : { companyId };
    return this.model.updateMany(filter, { $set: { isDefault: false } }).exec();
  }

  async countByCompany(companyId) {
    this._guard({ companyId });
    return this.model.countDocuments({ companyId });
  }
}

module.exports = new BranchRepository();
