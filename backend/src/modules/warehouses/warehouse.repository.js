'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Warehouse = require('./warehouse.model');

/** Repositorio de almacenes — tenant: companyId obligatorio (guardia Base). */
class WarehouseRepository extends BaseRepository {
  constructor() {
    super(Warehouse, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }

  async findDefault(companyId) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, isDefault: true }).lean();
  }

  async clearDefault(companyId) {
    this._guard({ companyId });
    return this.model.updateMany({ companyId, isDefault: true }, { $set: { isDefault: false } });
  }

  async findIdsByBranch(companyId, branchId) {
    this._guard({ companyId });
    const rows = await this.model.find({ companyId, branchId }).select('_id').lean();
    return rows.map((r) => r._id);
  }

  /** Desvincula almacenes de una sucursal eliminada (no borra almacenes). */
  async unassignBranch(companyId, branchId) {
    this._guard({ companyId });
    return this.model.updateMany({ companyId, branchId }, { $set: { branchId: null } });
  }

  async countByCompany(companyId) {
    this._guard({ companyId });
    return this.model.countDocuments({ companyId });
  }
}

module.exports = new WarehouseRepository();
