'use strict';

const mongoose = require('mongoose');

/**
 * WAREHOUSE — Almacenes de una empresa.
 * Colección: warehouses (siempre companyId-scoped)
 *
 * La empresa se aprovisiona con un almacén MAIN (code: 'MAIN', isDefault).
 * El stock por producto vive en stock_levels, referenciando warehouseId.
 */
const warehouseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    code: {
      type: String,
      required: 'El código del almacén es obligatorio.',
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    name: { type: String, required: 'El nombre del almacén es obligatorio.', trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 200, default: null },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, strict: true }
);

warehouseSchema.index({ companyId: 1, code: 1 }, { unique: true });
warehouseSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);
