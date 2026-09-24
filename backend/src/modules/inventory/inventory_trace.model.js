'use strict';

const mongoose = require('mongoose');

/** On-hand inventory by lot, or a single warehouse location for each serial. */
const inventoryTraceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    kind: { type: String, enum: ['lot', 'serial'], required: true },
    identifier: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    quantity: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

inventoryTraceSchema.index(
  { companyId: 1, productId: 1, warehouseId: 1, identifier: 1 },
  { unique: true, partialFilterExpression: { kind: 'lot' } }
);
inventoryTraceSchema.index(
  { companyId: 1, productId: 1, identifier: 1 },
  { unique: true, partialFilterExpression: { kind: 'serial' } }
);
inventoryTraceSchema.index({ companyId: 1, productId: 1, warehouseId: 1, kind: 1, quantity: 1 });

module.exports = mongoose.model('InventoryTrace', inventoryTraceSchema);
