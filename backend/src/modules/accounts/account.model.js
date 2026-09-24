'use strict';

const mongoose = require('mongoose');

/**
 * FINANCE ACCOUNT — Cuentas de efectivo/banco de una empresa.
 * Colección: finance_accounts (siempre companyId-scoped)
 *
 * Reglas (ADR-011):
 *  - `balance` lo gestiona SÓLO el servidor mediante incremento atómico
 *    condicionado (espera el saldo leído): los débitos no pueden dejar la
 *    cuenta en negativo; el cliente NUNCA envía el saldo.
 *  - `code` es único POR empresa (mayúsculas).
 *  - Una cuenta con movimientos no puede borrarse: se desactiva en su lugar.
 */
const financeAccountSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: {
      type: String,
      required: 'El código de la cuenta es obligatorio.',
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    name: { type: String, required: 'El nombre de la cuenta es obligatorio.', trim: true, maxlength: 120 },
    type: { type: String, enum: ['bank', 'cash', 'wallet'], default: 'bank' },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'USD' },
    currencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterData', default: null },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notes: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true, strict: true }
);

financeAccountSchema.index({ companyId: 1, code: 1 }, { unique: true });
financeAccountSchema.index({ companyId: 1, status: 1 });
financeAccountSchema.index({ companyId: 1, currencyId: 1 });

module.exports = mongoose.model('FinanceAccount', financeAccountSchema);
