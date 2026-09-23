'use strict';

const mongoose = require('mongoose');

/**
 * STOCK LEVEL — Existencia actual de un producto en un almacén.
 * Colección: stock_levels (siempre companyId-scoped)
 *
 * Invariante: quantity >= 0. Se respeta mediante decremento CONDICIONAL
 * atómico ({ quantity: { $gte: n } }) en stock_level.repository — ver
 * ADR-008 (reglas de stock, FASE 3).
 *
 * Una fila por (companyId, warehouseId, productId) — índice único compuesto.
 * Una fila con quantity 0 significa "agotado"; la ausencia de fila también.
 */
const stockLevelSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'La existencia no puede ser negativa.'],
      default: 0,
    },
  },
  { timestamps: true, strict: true }
);

stockLevelSchema.index({ companyId: 1, warehouseId: 1, productId: 1 }, { unique: true });
stockLevelSchema.index({ companyId: 1, productId: 1 });

module.exports = mongoose.model('StockLevel', stockLevelSchema);
