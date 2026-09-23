'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { nextSequence, formatCode } = require('../../common/sequence');
const expenseRepository = require('./expense.repository');
const accountService = require('../accounts/account.service');
const supplierRepository = require('../suppliers/supplier.repository');

/**
 * Servicio de GASTOS (FASE 5) — multiempresa estricto, APPEND-ONLY.
 * Mismas reglas que incomes (ADR-011):
 *  - Crear descuenta la cuenta (los DÉBITOS exigen saldo suficiente: si no
 *    alcanza ⇒ 409 y se elimina el documento creado, compensación mejor
 *    esfuerzo).
 *  - Anular marca POSTED→VOID condicionalmente y luego invierte el descuento.
 */
const CODE_KEY = 'expenses';
const CODE_PREFIX = 'EXP';

const expenseService = {
  async list(filter, options) {
    return expenseRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return expenseRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const account = await accountService.loadActiveAccount(data.accountId, companyId);
    if (data.supplierId) {
      const supplier = await supplierRepository.findById(data.supplierId, { companyId });
      if (!supplier) throw ApiError.notFound('Recurso no encontrado.');
    }

    const seq = await nextSequence(companyId, CODE_KEY);
    const expense = await expenseRepository.create({
      companyId,
      code: formatCode(CODE_PREFIX, seq),
      amount: data.amount,
      date: data.date || new Date(),
      category: data.category,
      method: data.method || 'transfer',
      accountId: account._id,
      supplierId: data.supplierId || null,
      reference: data.reference || null,
      description: data.description || null,
      status: 'POSTED',
      createdBy: userId || null,
    });

    try {
      await accountService.applyMovement(companyId, account._id, -data.amount);
    } catch (err) {
      await expenseRepository
        .deleteById(expense._id, { companyId })
        .catch((delErr) =>
          logger.error({ err: delErr.message }, 'Compensación de creación de gasto falló')
        );
      throw err;
    }

    return expense;
  },

  async void(id, data, companyId, userId) {
    const expense = await expenseRepository.findById(id, { companyId });
    if (!expense) throw ApiError.notFound('Recurso no encontrado.');
    if (expense.status === 'VOID') throw ApiError.conflict('El registro ya fue anulado.');

    const voided = await expenseRepository.markVoided(
      id,
      { companyId },
      { voidedBy: userId || null, voidedAt: new Date(), voidReason: data.reason }
    );
    if (!voided) throw ApiError.conflict('El registro ya fue anulado.');

    // Reponer el dinero descontado (allowInactive: corrección contable).
    try {
      await accountService.applyMovement(companyId, expense.accountId, expense.amount, {
        allowInactive: true,
      });
    } catch (err) {
      await expenseRepository
        .updateById(
          id,
          { status: 'POSTED', voidedBy: null, voidedAt: null, voidReason: null },
          { companyId }
        )
        .catch((revErr) =>
          logger.error({ err: revErr.message }, 'Reversión de anulación de gasto falló')
        );
      throw err;
    }

    return expenseRepository.getByIdSafe(id, companyId);
  },
};

module.exports = expenseService;
