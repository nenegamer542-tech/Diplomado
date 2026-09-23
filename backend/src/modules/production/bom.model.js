'use strict';

const mongoose = require('mongoose');

/**
 * BOM — Lista de materiales: producto terminado + componentes.
 * Colección: boms (siempre companyId-scoped)
 *
 *  - `code` secuencial POR empresa (BOM-000001…, contador atómico ADR-009).
 *  - Ciclo de vida por estado active|inactive (ADR-012, sin `.delete`).
 *  - Una OT sólo puede usar una BOM activa; al liberar la orden los
 *    componentes se copian (snapshot) y se escalan (ADR-013).
 */
const componentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: {
      type: Number,
      required: true,
      min: [0.0001, 'La cantidad debe ser mayor que cero.'],
    },
  },
  { _id: false, strict: true }
);

const bomSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, maxlength: 20 },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    components: {
      type: [componentSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'La lista debe incluir al menos un componente.',
      },
    },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, strict: true }
);

bomSchema.index({ companyId: 1, code: 1 }, { unique: true });
bomSchema.index({ companyId: 1, productId: 1 });
bomSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Bom', bomSchema);
