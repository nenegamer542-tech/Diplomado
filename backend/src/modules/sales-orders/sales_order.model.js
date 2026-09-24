'use strict';

const mongoose = require('mongoose');

/**
 * SALES ORDER — Pedidos de venta de una empresa.
 * Colección: sales_orders (siempre companyId-scoped)
 *
 * Flujo (ADR-010): DRAFT → APPROVED | REJECTED.
 *  - Sólo se crea/edita en DRAFT; no hay DELETE (se rechaza el documento).
 *  - APROBAR ejecuta el asiento de inventario: una SALIDA por línea desde
 *    `warehouseId` con decremento condicional (409 si no alcanza el stock,
 *    ADR-008) y compensación de las líneas ya descontadas.
 *  - `code` es secuencial POR empresa (SO-000001…, contador atómico ADR-009).
 *  - `total` lo calcula SIEMPRE el servidor (suma de líneas).
 */
const lineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: [1, 'La cantidad debe ser mayor que cero.'] },
    unitPrice: { type: Number, required: true, min: [0, 'El precio no puede ser negativo.'] },
    traceability: { type: [{ identifier: { type: String, required: true, uppercase: true, maxlength: 64 }, quantity: { type: Number, required: true, min: 0.0001 } }], default: undefined },
  },
  { _id: false, strict: true }
);

const salesOrderSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, maxlength: 20 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'REJECTED'], default: 'DRAFT', index: true },
    lines: {
      type: [lineSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'El pedido debe incluir al menos una línea.',
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

salesOrderSchema.index({ companyId: 1, code: 1 }, { unique: true });
salesOrderSchema.index({ companyId: 1, status: 1, createdAt: -1 });
salesOrderSchema.index({ companyId: 1, customerId: 1, createdAt: -1 });
salesOrderSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('SalesOrder', salesOrderSchema);
