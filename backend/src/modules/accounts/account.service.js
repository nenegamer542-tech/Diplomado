'use strict';

const ApiError = require('../../utils/ApiError');
const accountRepository = require('./account.repository');
const incomeRepository = require('../incomes/income.repository');
const expenseRepository = require('../expenses/expense.repository');

/**
 * Servicio de CUENTAS financieras (FASE 5) — multiempresa estricto.
 *
 * Reglas (ADR-011):
 *  - companyId SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - `balance` sólo se modifica vía applyMovement: escritura atómica
 *    condicionada al saldo leído (optimista, igual que ADR-008). Los DÉBITOS
 *    no pueden dejar la cuenta en negativo; los abonos siempre se permiten
 *    (aunque la cuenta estuviera en negativo, asÍ se recupera).
 *  - Una cuenta con movimientos no se borra: se desactiva (409).
 */
const round2 = (n) => Math.round(n * 100) / 100;

const accountService = {
  async list(filter, options) {
    return accountRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return accountRepository.findById(id, { companyId });
  },

  /** Carga para movimiento: 404 si no existe/ajena; 409 si inactiva. */
  async loadActiveAccount(accountId, companyId) {
    const account = await accountRepository.findById(accountId, { companyId });
    if (!account) throw ApiError.notFound('Recurso no encontrado.');
    if (account.status !== 'active') {
      throw ApiError.conflict('La cuenta está inactiva; no admite movimientos financieros.');
    }
    return account;
  },

  async create(data, companyId) {
    const code = String(data.code).toUpperCase();
    const existing = await accountRepository.findByCode(companyId, code);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
    }
    return accountRepository.create({ ...data, code, companyId, balance: 0 });
  },

  async update(id, data, companyId) {
    const account = await accountRepository.findById(id, { companyId });
    if (!account) throw ApiError.notFound('Recurso no encontrado.');

    const patch = { ...data };
    delete patch.balance; // el saldo nunca se edita desde el cliente
    if (patch.code) {
      const code = String(patch.code).toUpperCase();
      const existing = await accountRepository.findByCode(companyId, code);
      if (existing && String(existing._id) !== id) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
      }
      patch.code = code;
    }

    return accountRepository.updateById(id, patch, { companyId });
  },

  /** Borrado sólo si la cuenta nunca tuvo ingresos ni gastos (si no, desactivar). */
  async remove(id, companyId) {
    const account = await accountRepository.findById(id, { companyId });
    if (!account) throw ApiError.notFound('Recurso no encontrado.');

    const [hasIncome, hasExpense] = await Promise.all([
      incomeRepository.exists({ companyId, accountId: id }),
      expenseRepository.exists({ companyId, accountId: id }),
    ]);
    if (hasIncome || hasExpense) {
      throw ApiError.conflict(
        'La cuenta tiene movimientos: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
      );
    }

    return accountRepository.deleteById(id, { companyId });
  },

  /**
   * Aplica un movimiento firmado al saldo (+ingreso / -gasto) con escritura
   * atómica condicionada al saldo leído. Reintenta ante carreras (máx. 3).
   *
   * @param {number} delta - importe firmado.
   * @param {object} [options]
   * @param {boolean} [options.allowInactive] - sólo para ANULACIONES: invierte
   *   el movimiento aunque la cuenta esté inactiva o el saldo quede negativo
   *   (es una corrección contable, no un movimiento nuevo).
   * @returns {Promise<object>} cuenta con el saldo actualizado.
   */
  async applyMovement(companyId, accountId, delta, { allowInactive = false } = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const account = await accountRepository.findById(accountId, { companyId });
      if (!account) throw ApiError.notFound('Recurso no encontrado.');
      if (!allowInactive && account.status !== 'active') {
        throw ApiError.conflict('La cuenta está inactiva; no admite movimientos financieros.');
      }

      const newBalance = round2(account.balance + delta);
      if (!allowInactive && delta < 0 && newBalance < 0) {
        throw ApiError.conflict('Saldo insuficiente en la cuenta indicado.', {
          available: account.balance,
        });
      }

      const updated = await accountRepository.updateBalance(
        companyId,
        accountId,
        account.balance,
        newBalance
      );
      if (updated) return updated;
      // El saldo cambió entre lectura y escritura: re-leer y reintentar.
    }
    throw ApiError.conflict('El saldo cambió durante la operación. Intente de nuevo.');
  },
};

module.exports = accountService;
