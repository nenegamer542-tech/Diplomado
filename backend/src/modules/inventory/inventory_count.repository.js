'use strict';

const BaseRepository = require('../../common/BaseRepository');
const InventoryCount = require('./inventory_count.model');

class InventoryCountRepository extends BaseRepository {
  constructor() {
    super(InventoryCount, { requireTenant: true });
  }

  async claimPosting(id, companyId, staleBefore) {
    this._guard({ companyId });
    return this.model.findOneAndUpdate(
      {
        _id: id,
        companyId,
        $or: [
          { status: { $in: ['DRAFT', 'PARTIAL'] } },
          { status: 'POSTING', postingStartedAt: { $lt: staleBefore } },
        ],
      },
      { $set: { status: 'POSTING', postingStartedAt: new Date() } },
      { new: true }
    );
  }
}

module.exports = new InventoryCountRepository();
