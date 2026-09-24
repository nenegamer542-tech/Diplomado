'use strict';

const mongoose = require('mongoose');

const traceabilitySchema = new mongoose.Schema({
  identifier: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  quantity: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, default: null },
}, { _id: false, strict: true });

const countLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  expectedQuantity: { type: Number, required: true, min: 0 },
  countedQuantity: { type: Number, required: true, min: 0 },
  expectedTraceability: { type: [traceabilitySchema], default: [] },
  countedTraceability: { type: [traceabilitySchema], default: [] },
  applied: { type: Boolean, default: false },
  movementId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryMovement', default: null },
}, { strict: true });

const inventoryCountSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  code: { type: String, required: true, maxlength: 24 },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  status: { type: String, enum: ['DRAFT', 'POSTING', 'PARTIAL', 'POSTED'], default: 'DRAFT' },
  lines: { type: [countLineSchema], required: true, validate: (lines) => lines.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  postingStartedAt: { type: Date, default: null },
  postedAt: { type: Date, default: null },
}, { timestamps: true, strict: true });

inventoryCountSchema.index({ companyId: 1, code: 1 }, { unique: true });
inventoryCountSchema.index({ companyId: 1, warehouseId: 1, createdAt: -1 });
inventoryCountSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryCount', inventoryCountSchema);
