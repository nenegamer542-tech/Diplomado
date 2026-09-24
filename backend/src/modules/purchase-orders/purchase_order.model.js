'use strict';

const mongoose = require('mongoose');

/**
 * PURCHASE ORDER — Órdenes de compra de una empresa.
 * Colección: purchase_orders (siempre companyId-scoped)
 *
 * Flujo (ADR-010): DRAFT → APPROVED | REJECTED.
 *  - Sólo se crea/edita en DRAFT; no hay DELETE (se rechaza el documento).
 *  - APROBAR ejecuta el asiento de inventario: una ENTRADA por línea en
 *    `warehouseId` (validada/compensada por inventory.service, ADR-008).
 *  - `code` es secuencial POR empresa (PO-000001…, contador atómico ADR-009).
 *  - `total` lo calcula SIEMPRE el servidor (suma de líneas).
 */
const lineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: [1, 'La cantidad debe ser mayor que cero.'] },
    unitCost: { type: Number, required: true, min: [0, 'El costo no puede ser negativo.'] },
    traceability: { type: [{ identifier: { type: String, required: true, uppercase: true, maxlength: 64 }, quantity: { type: Number, required: true, min: 0.0001 }, expiryDate: Date }], default: undefined },
  },
  { _id: false, strict: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, maxlength: 20 },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'REJECTED'], default: 'DRAFT', index: true },
    lines: {
      type: [lineSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'La orden debe incluir al menos una línea.',
      },
    },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 240, default: null },
  },
  { timestamps: true, strict: true }
);

purchaseOrderSchema.index({ companyId: 1, code: 1 }, { unique: true });
purchaseOrderSchema.index({ companyId: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ companyId: 1, supplierId: 1, createdAt: -1 });
purchaseOrderSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
