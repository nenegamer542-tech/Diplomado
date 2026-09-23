'use strict';

const mongoose = require('mongoose');

/**
 * INCOME — Ingresos (cobros) de una empresa.
 * Colección: incomes (siempre companyId-scoped)
 *
 * Reglas (ADR-011):
 *  - APPEND-ONLY: se crea, se lee y se ANULA (status VOID); NO se edita ni
 *    se borra. La anulación invierte el saldo de la cuenta (puede dejarlo en
 *    negativo: es una corrección contable, no un movimiento nuevo).
 *  - `code` es secuencial POR empresa (INC-000001…, contador atómico ADR-009).
 *  - `amount` > 0 siempre; el signo lo aporta el tipo de movimiento.
 */
const incomeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, maxlength: 20 },
    amount: { type: Number, required: true, min: [0.01, 'El importe debe ser mayor que cero.'] },
    date: { type: Date, required: true, default: Date.now },
    category: { type: String, required: 'La categoría es obligatoria.', trim: true, maxlength: 60 },
    method: { type: String, enum: ['cash', 'transfer', 'card', 'check', 'other'], default: 'transfer' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceAccount', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    reference: { type: String, trim: true, maxlength: 40, default: null },
    description: { type: String, trim: true, maxlength: 200, default: null },
    status: { type: String, enum: ['POSTED', 'VOID'], default: 'POSTED', index: true },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, trim: true, maxlength: 240, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, strict: true }
);

incomeSchema.index({ companyId: 1, code: 1 }, { unique: true });
incomeSchema.index({ companyId: 1, date: -1 });
incomeSchema.index({ companyId: 1, accountId: 1, date: -1 });
incomeSchema.index({ companyId: 1, category: 1, date: -1 });

module.exports = mongoose.model('Income', incomeSchema);
