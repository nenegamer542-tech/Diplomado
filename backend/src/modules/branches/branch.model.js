'use strict';

const mongoose = require('mongoose');

/**
 * BRANCH — Sucursal dentro de una empresa.
 * Colección: branches  (siempre companyId-scoped)
 */
const branchSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    code: { type: String, required: [true, 'El código es obligatorio.'], trim: true, uppercase: true, maxlength: 20 },
    name: { type: String, required: [true, 'El nombre es obligatorio.'], trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 240 },
    phone: { type: String, trim: true, maxlength: 30 },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

// Código único POR EMPRESA (clave compuesta => multiempresa correcto).
branchSchema.index({ companyId: 1, code: 1 }, { unique: true });
branchSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Branch', branchSchema);
