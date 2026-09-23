'use strict';

const mongoose = require('mongoose');

/**
 * EXPENSE — Gastos (pagos) de una empresa.
 * Colección: expenses (siempre companyId-scoped)
 *
 * Reglas (ADR-011), idénticas a incomes:
 *  - APPEND-ONLY: crear / leer / ANULAR; sin edición ni borrado.
 *  - `code` secuencial POR empresa (EXP-000001…, ADR-009).
 *  - Al crear descuenta la cuenta (los débitos exigen saldo suficiente); la
 *    anulación invierte el descuento.
 */
const expenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, maxlength: 20 },
    amount: { type: Number, required: true, min: [0.01, 'El importe debe ser mayor que cero.'] },
    date: { type: Date, required: true, default: Date.now },
    category: { type: String, required: 'La categoría es obligatoria.', trim: true, maxlength: 60 },
    method: { type: String, enum: ['cash', 'transfer', 'card', 'check', 'other'], default: 'transfer' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceAccount', required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
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

expenseSchema.index({ companyId: 1, code: 1 }, { unique: true });
expenseSchema.index({ companyId: 1, date: -1 });
expenseSchema.index({ companyId: 1, accountId: 1, date: -1 });
expenseSchema.index({ companyId: 1, category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
