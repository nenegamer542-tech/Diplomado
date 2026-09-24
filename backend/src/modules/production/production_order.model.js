'use strict';

const mongoose = require('mongoose');

/**
 * PRODUCTION ORDER — Órdenes de producción (OT) de una empresa.
 * Colección: production_orders (siempre companyId-scoped)
 *
 * Flujo (ADR-013): DRAFT → RELEASED → DONE | CANCELLED.
 *  - Sólo se crea/edita en DRAFT; sin DELETE (la baja es por estado, ADR-012).
 *  - RELEASE copia los componentes de la BOM escalados por `quantity`
 *    (snapshot en `lines`) y ejecuta una SALIDA por componente, con las
 *    compensaciones de inventory.service (ADR-008).
 *  - DONE genera una ENTRADA del producto terminado en `warehouseId`.
 *  - CANCELLED desde RELEASED devuelve los componentes (entrada
 *    compensatoria); el motivo es obligatorio (trazabilidad).
 *  - `code` secuencial POR empresa (MO-000001…, contador atómico ADR-009).
 */
const lineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: {
      type: Number,
      required: true,
      min: [0.0001, 'La cantidad debe ser mayor que cero.'],
    },
    traceability: { type: [{ identifier: { type: String, required: true, uppercase: true, maxlength: 64 }, quantity: { type: Number, required: true, min: 0.0001 }, expiryDate: Date }], default: undefined },
  },
  { _id: false, strict: true }
);

const productionOrderSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, maxlength: 20 },
    bomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bom', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: {
      type: Number,
      required: true,
      min: [0.0001, 'La cantidad debe ser mayor que cero.'],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'RELEASED', 'DONE', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    // Snapshot de componentes escrito en RELEASE (no se toca después).
    lines: { type: [lineSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedAt: { type: Date, default: null },
    doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    doneAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 240, default: null },
  },
  { timestamps: true, strict: true }
);

productionOrderSchema.index({ companyId: 1, code: 1 }, { unique: true });
productionOrderSchema.index({ companyId: 1, status: 1, createdAt: -1 });
productionOrderSchema.index({ companyId: 1, bomId: 1 });
productionOrderSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('ProductionOrder', productionOrderSchema);
