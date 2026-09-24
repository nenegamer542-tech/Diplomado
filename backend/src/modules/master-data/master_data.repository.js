'use strict';

const BaseRepository = require('../../common/BaseRepository');
const MasterData = require('./master_data.model');

class MasterDataRepository extends BaseRepository {
  constructor() {
    super(MasterData, { requireTenant: true });
  }

  async findByCode(companyId, type, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, type, code }).lean();
  }
}

module.exports = new MasterDataRepository();
