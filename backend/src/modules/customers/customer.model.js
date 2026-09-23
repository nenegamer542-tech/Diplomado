'use strict';

const mongoose = require('mongoose');

/**
 * CUSTOMER — Clientes de una empresa.
 * Colección: customers (siempre companyId-scoped)
 *
 * `code` es único POR empresa (mayúsculas). El borrado está bloqueado si el
 * cliente tiene pedidos de venta (se desactiva en su lugar).
 */
const customerSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: {
      type: String,
      required: 'El código del cliente es obligatorio.',
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    name: { type: String, required: 'El nombre del cliente es obligatorio.', trim: true, maxlength: 120 },
    taxId: { type: String, trim: true, uppercase: true, maxlength: 20, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: null },
    phone: { type: String, trim: true, maxlength: 30, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, strict: true }
);

customerSchema.index({ companyId: 1, code: 1 }, { unique: true });
customerSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Customer', customerSchema);
