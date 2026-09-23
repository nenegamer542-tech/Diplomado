'use strict';

const mongoose = require('mongoose');

/**
 * BUDGET — Presupuesto mensual por categoría de una empresa.
 * Colección: budgets (siempre companyId-scoped)
 *
 * Reglas (ADR-011):
 *  - Un presupuesto por (empresa, año, mes, categoría) — índice único.
 *  - Sólo guarda lo PLANIFICADO (`plannedAmount`); lo ejecutado se calcula
 *    en el momento desde expenses (reports /reports/budgets).
 */
const budgetSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    category: { type: String, required: 'La categoría es obligatoria.', trim: true, maxlength: 60 },
    plannedAmount: {
      type: Number,
      required: true,
      min: [0, 'El importe planeado no puede ser negativo.'],
    },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, strict: true }
);

budgetSchema.index({ companyId: 1, year: 1, month: 1, category: 1 }, { unique: true });
budgetSchema.index({ companyId: 1, year: 1, month: 1 });

module.exports = mongoose.model('Budget', budgetSchema);
