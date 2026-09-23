'use strict';

const mongoose = require('mongoose');

/**
 * LEAD — Prospecto de CRM de una empresa.
 * Colección: leads (siempre companyId-scoped)
 *
 * Ciclo de vida (ADR-012): el módulo NO declara `.delete` en el catálogo de
 * permisos; la baja es por cambio de estado, nunca por borrado físico:
 *   NEW → CONTACTED → QUALIFIED → WON | LOST   (WON y LOST son terminales).
 */
const leadSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: 'El nombre del contacto es obligatorio.', trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 120, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: null },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    source: { type: String, enum: ['web', 'referral', 'call', 'event', 'other'], default: 'other' },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'],
      default: 'NEW',
      index: true,
    },
    expectedAmount: { type: Number, min: [0, 'El importe previsto no puede ser negativo.'], default: 0 },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, strict: true }
);

leadSchema.index({ companyId: 1, status: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('Lead', leadSchema);
