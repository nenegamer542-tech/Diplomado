'use strict';

const BaseRepository = require('../../common/BaseRepository');
const InventoryTrace = require('./inventory_trace.model');

class InventoryTraceRepository extends BaseRepository {
  constructor() {
    super(InventoryTrace, { requireTenant: true });
  }

  async findByIdentifier(companyId, productId, identifier) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, productId, kind: 'serial', identifier }).lean();
  }

  async increaseLot(data, quantity) {
    this._guard(data);
    return this.model.findOneAndUpdate(
      { companyId: data.companyId, productId: data.productId, warehouseId: data.warehouseId, kind: 'lot', identifier: data.identifier },
      {
        $setOnInsert: { companyId: data.companyId, productId: data.productId, warehouseId: data.warehouseId, kind: 'lot', identifier: data.identifier },
        $inc: { quantity },
        ...(data.expiryDate ? { $set: { expiryDate: data.expiryDate } } : {}),
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
  }

  async decrementLot(companyId, productId, warehouseId, identifier, quantity) {
    this._guard({ companyId });
    return this.model.findOneAndUpdate(
      { companyId, productId, warehouseId, kind: 'lot', identifier, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true }
    ).lean();
  }

  async setLotState(companyId, productId, warehouseId, identifier, expectedQuantity, expectedExpiryDate, quantity, expiryDate) {
    this._guard({ companyId });
    const filter = { companyId, productId, warehouseId, kind: 'lot', identifier, quantity: expectedQuantity };
    if (expectedQuantity > 0) filter.expiryDate = expectedExpiryDate || null;
    try {
      return await this.model.findOneAndUpdate(
        filter,
        {
          $set: { quantity, expiryDate: expiryDate || null },
          ...(expectedQuantity === 0 ? { $setOnInsert: { companyId, productId, warehouseId, kind: 'lot', identifier } } : {}),
        },
        { upsert: expectedQuantity === 0 && quantity > 0, new: true, runValidators: true }
      ).lean();
    } catch (err) {
      if (err?.code === 11000) return null;
      throw err;
    }
  }

  async createSerial(data) {
    this._guard(data);
    return this.model.create({ ...data, kind: 'serial', quantity: 1 });
  }

  async reactivateSerial(companyId, productId, warehouseId, identifier) {
    this._guard({ companyId });
    return this.model.findOneAndUpdate(
      { companyId, productId, identifier, kind: 'serial', quantity: 0 },
      { $set: { warehouseId, quantity: 1 } },
      { new: true }
    ).lean();
  }

  async restoreSerialLocation(companyId, productId, currentWarehouseId, previousWarehouseId, identifier) {
    this._guard({ companyId });
    return this.model.findOneAndUpdate(
      { companyId, productId, warehouseId: currentWarehouseId, kind: 'serial', identifier, quantity: 0 },
      { $set: { warehouseId: previousWarehouseId } },
      { new: true }
    ).lean();
  }

  async deactivateSerial(companyId, productId, warehouseId, identifier) {
    this._guard({ companyId });
    return this.model.findOneAndUpdate(
      { companyId, productId, warehouseId, kind: 'serial', identifier, quantity: 1 },
      { $set: { quantity: 0 } },
      { new: true }
    ).lean();
  }

  async moveSerial(companyId, productId, fromWarehouseId, toWarehouseId, identifier) {
    this._guard({ companyId });
    return this.model.findOneAndUpdate(
      { companyId, productId, warehouseId: fromWarehouseId, kind: 'serial', identifier, quantity: 1 },
      { $set: { warehouseId: toWarehouseId } },
      { new: true }
    ).lean();
  }

  async listForProduct(companyId, productId, filter = {}) {
    this._guard({ companyId });
    return this.model.find({ companyId, productId, ...filter }).lean();
  }

  async hasRecords(companyId, productId) {
    this._guard({ companyId });
    return this.model.exists({ companyId, productId });
  }

  async removeById(id, companyId) {
    return this.deleteById(id, { companyId });
  }
}

module.exports = new InventoryTraceRepository();
