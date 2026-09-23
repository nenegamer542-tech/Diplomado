'use strict';

const mongoose = require('mongoose');

/**
 * PRODUCT — Catálogo de productos/artículos de una empresa.
 * Colección: products (siempre companyId-scoped)
 *
 * El stock NO vive aquí: cada existencia por almacén está en stock_levels y
 * su historial inmutable en inventory_movements (FASE 3).
 */
const productSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    sku: {
      type: String,
      required: 'El SKU es obligatorio.',
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    name: { type: String, required: 'El nombre del producto es obligatorio.', trim: true, maxlength: 120 },
    barcode: { type: String, trim: true, maxlength: 64, default: null },
    description: { type: String, trim: true, maxlength: 500, default: null },
    category: { type: String, trim: true, maxlength: 60, default: null },
    unit: { type: String, trim: true, maxlength: 20, default: 'pza' },
    costPrice: { type: Number, min: [0, 'El precio de costo no puede ser negativo.'], default: 0 },
    salePrice: { type: Number, min: [0, 'El precio de venta no puede ser negativo.'], default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    minStock: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, strict: true }
);

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, status: 1 });
productSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('Product', productSchema);
