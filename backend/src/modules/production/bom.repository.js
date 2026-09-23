'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Bom = require('./bom.model');

/** Repositorio de listas de materiales — tenant: companyId obligatorio. */
class BomRepository extends BaseRepository {
  constructor() {
    super(Bom, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }
}

module.exports = new BomRepository();
