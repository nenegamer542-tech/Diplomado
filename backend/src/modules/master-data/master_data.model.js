'use strict';

const mongoose = require('mongoose');

const masterDataSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['category', 'brand', 'unit', 'currency', 'tax'],
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 240, default: null },
    symbol: { type: String, trim: true, maxlength: 12, default: null },
    decimalPlaces: { type: Number, min: 0, max: 6, default: null },
    allowFractions: { type: Boolean, default: null },
    rate: { type: Number, min: 0, max: 100, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, strict: true }
);

masterDataSchema.index({ companyId: 1, type: 1, code: 1 }, { unique: true });
masterDataSchema.index({ companyId: 1, type: 1, status: 1, name: 1 });

module.exports = mongoose.model('MasterData', masterDataSchema);
