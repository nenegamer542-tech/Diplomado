'use strict';

/**
 * Reglas de FASE 5 (ADR-011): cuentas con saldo optimista condicionado,
 * ingresos/gastos APPEND-ONLY con anulación (compensaciones incluidas)
 * y presupuestos con clave única. Multiempresa: ID ajeno ⇒ 404.
 */

jest.mock('../../src/config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../src/common/sequence', () => ({
  ...jest.requireActual('../../src/common/sequence'),
  nextSequence: jest.fn(),
}));
jest.mock('../../src/modules/accounts/account.repository', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  exists: jest.fn(),
  find: jest.fn(),
  updateBalance: jest.fn(),
}));
jest.mock('../../src/modules/incomes/income.repository', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  exists: jest.fn(),
  find: jest.fn(),
  markVoided: jest.fn(),
  getByIdSafe: jest.fn(),
}));
jest.mock('../../src/modules/expenses/expense.repository', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  exists: jest.fn(),
  find: jest.fn(),
  markVoided: jest.fn(),
  getByIdSafe: jest.fn(),
}));
jest.mock('../../src/modules/budgets/budget.repository', () => ({
  findById: jest.fn(),
  findByKey: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../src/modules/customers/customer.repository', () => ({ findById: jest.fn() }));
jest.mock('../../src/modules/suppliers/supplier.repository', () => ({ findById: jest.fn() }));

const { nextSequence } = require('../../src/common/sequence');
const accountRepository = require('../../src/modules/accounts/account.repository');
const incomeRepository = require('../../src/modules/incomes/income.repository');
const expenseRepository = require('../../src/modules/expenses/expense.repository');
const budgetRepository = require('../../src/modules/budgets/budget.repository');
const customerRepository = require('../../src/modules/customers/customer.repository');
const supplierRepository = require('../../src/modules/suppliers/supplier.repository');
const accountService = require('../../src/modules/accounts/account.service');
const incomeService = require('../../src/modules/incomes/income.service');
const expenseService = require('../../src/modules/expenses/expense.service');
const budgetService = require('../../src/modules/budgets/budget.service');

const COMPANY = '64b00000000000000000000a';
const ACC = '64b000000000000000000201';
const OTHER = '64b0000000000000000002ff';

const activeAccount = (balance = 100) => ({ _id: ACC, companyId: COMPANY, balance, status: 'active' });

beforeEach(() => {
  jest.resetAllMocks();
});

describe('accountService.applyMovement — saldo optimista (ADR-011)', () => {
  test('abono: escritura condicionada al saldo leído', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: 150 });

    const result = await accountService.applyMovement(COMPANY, ACC, 50);

    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, 100, 150);
    expect(result.balance).toBe(150);
  });

  test('débito sin saldo suficiente ⇒ 409 canónico con details.available', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(30));

    await expect(accountService.applyMovement(COMPANY, ACC, -50)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Saldo insuficiente en la cuenta indicado.',
      details: { available: 30 },
    });
    expect(accountRepository.updateBalance).not.toHaveBeenCalled();
  });

  test('abono a cuenta en negativo siempre se permite (recuperación)', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(-20));
    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: -10 });

    await accountService.applyMovement(COMPANY, ACC, 10);

    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, -20, -10);
  });

  test('cuenta inactiva ⇒ 409; con allowInactive (anulación) sí se aplica', async () => {
    accountRepository.findById.mockResolvedValue({ ...activeAccount(0), status: 'inactive' });

    await expect(accountService.applyMovement(COMPANY, ACC, -10)).rejects.toMatchObject({
      statusCode: 409,
      message: 'La cuenta está inactiva; no admite movimientos financieros.',
    });

    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: -50 });
    await accountService.applyMovement(COMPANY, ACC, -50, { allowInactive: true });
    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, 0, -50);
  });

  test('cuenta ajena/inexistente ⇒ 404', async () => {
    accountRepository.findById.mockResolvedValue(null);
    await expect(accountService.applyMovement(COMPANY, ACC, 10)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
  });

  test('carrera de saldo: reintenta con el saldo re-leído', async () => {
    accountRepository.findById
      .mockResolvedValueOnce(activeAccount(100))
      .mockResolvedValueOnce(activeAccount(120));
    accountRepository.updateBalance
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: ACC, balance: 170 });

    await accountService.applyMovement(COMPANY, ACC, 50);

    expect(accountRepository.updateBalance).toHaveBeenNthCalledWith(1, COMPANY, ACC, 100, 150);
    expect(accountRepository.updateBalance).toHaveBeenNthCalledWith(2, COMPANY, ACC, 120, 170);
  });

  test('carrera persistente: 3 intentos ⇒ 409 de reintento', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    accountRepository.updateBalance.mockResolvedValue(null);

    await expect(accountService.applyMovement(COMPANY, ACC, 10)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El saldo cambió durante la operación. Intente de nuevo.',
    });
    expect(accountRepository.findById).toHaveBeenCalledTimes(3);
  });
});

describe('accountService — CRUD y guardas', () => {
  test('create: código en mayúsculas y saldo inicial 0', async () => {
    accountRepository.findByCode.mockResolvedValue(null);
    accountRepository.create.mockResolvedValue({ _id: ACC, code: 'BCO-1' });

    await accountService.create({ code: 'bco-1', name: 'Banco' }, COMPANY);

    expect(accountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BCO-1', companyId: COMPANY, balance: 0 })
    );
  });

  test('create duplicado ⇒ 409 canónico con fields', async () => {
    accountRepository.findByCode.mockResolvedValue({ _id: OTHER });

    await expect(accountService.create({ code: 'BCO-1', name: 'Banco' }, COMPANY)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ya existe un registro con ese valor en: code.',
      details: { fields: ['code'] },
    });
    expect(accountRepository.create).not.toHaveBeenCalled();
  });

  test('update: NUNCA propaga balance del cliente', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    accountRepository.updateById.mockResolvedValue({ _id: ACC, name: 'Nuevo' });

    await accountService.update(ACC, { name: 'Nuevo', balance: 9999 }, COMPANY);

    expect(accountRepository.updateById).toHaveBeenCalledWith(ACC, { name: 'Nuevo' }, { companyId: COMPANY });
  });

  test('update de cuenta ajena ⇒ 404', async () => {
    accountRepository.findById.mockResolvedValue(null);
    await expect(accountService.update(ACC, { name: 'X' }, COMPANY)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
  });

  test('remove con movimientos ⇒ 409 de desactivación (no borra)', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount());
    incomeRepository.exists.mockResolvedValue({ _id: 'x' });
    expenseRepository.exists.mockResolvedValue(null);

    await expect(accountService.remove(ACC, COMPANY)).rejects.toMatchObject({
      statusCode: 409,
      message:
        'La cuenta tiene movimientos: no se puede eliminar. Desactívelo (status inactive) en su lugar.',
    });
    expect(accountRepository.deleteById).not.toHaveBeenCalled();
  });

  test('remove sin movimientos ⇒ borra; cuenta inexistente ⇒ 404', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount());
    incomeRepository.exists.mockResolvedValue(null);
    expenseRepository.exists.mockResolvedValue(null);
    accountRepository.deleteById.mockResolvedValue({ _id: ACC });

    await accountService.remove(ACC, COMPANY);
    expect(accountRepository.deleteById).toHaveBeenCalledWith(ACC, { companyId: COMPANY });

    accountRepository.findById.mockResolvedValue(null);
    await expect(accountService.remove(ACC, COMPANY)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('incomeService — append-only con compensaciones', () => {
  test('create: código INC secuencial, documento POSTED y saldo acreditado', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    nextSequence.mockResolvedValue(7);
    incomeRepository.create.mockResolvedValue({ _id: 'inc1', code: 'INC-000007' });
    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: 150 });

    const result = await incomeService.create(
      { amount: 50, category: 'Ventas', accountId: ACC },
      COMPANY,
      'user1'
    );

    expect(nextSequence).toHaveBeenCalledWith(COMPANY, 'incomes');
    expect(incomeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        code: 'INC-000007',
        amount: 50,
        category: 'Ventas',
        accountId: ACC,
        status: 'POSTED',
        createdBy: 'user1',
      })
    );
    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, 100, 150);
    expect(result.code).toBe('INC-000007');
  });

  test('cliente ajeno ⇒ 404 ANTES de consumir numeración', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount());
    customerRepository.findById.mockResolvedValue(null);

    await expect(
      incomeService.create(
        { amount: 10, category: 'Ventas', accountId: ACC, customerId: OTHER },
        COMPANY,
        null
      )
    ).rejects.toMatchObject({ statusCode: 404, message: 'Recurso no encontrado.' });
    expect(nextSequence).not.toHaveBeenCalled();
    expect(incomeRepository.create).not.toHaveBeenCalled();
  });

  test('cuenta inactiva ⇒ 409 y no se crea nada', async () => {
    accountRepository.findById.mockResolvedValue({ ...activeAccount(), status: 'inactive' });

    await expect(
      incomeService.create({ amount: 10, category: 'Ventas', accountId: ACC }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'La cuenta está inactiva; no admite movimientos financieros.',
    });
    expect(incomeRepository.create).not.toHaveBeenCalled();
  });

  test('si el saldo falla tras crear ⇒ se BORRA el documento (compensación) y se relanza', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    nextSequence.mockResolvedValue(1);
    incomeRepository.create.mockResolvedValue({ _id: 'inc1', code: 'INC-000001' });
    accountRepository.updateBalance.mockResolvedValue(null); // carrera persistente
    incomeRepository.deleteById.mockResolvedValue({ _id: 'inc1' });

    await expect(
      incomeService.create({ amount: 50, category: 'Ventas', accountId: ACC }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El saldo cambió durante la operación. Intente de nuevo.',
    });
    expect(incomeRepository.deleteById).toHaveBeenCalledWith('inc1', { companyId: COMPANY });
  });
});

describe('incomeService.void — anulación condicional', () => {
  test('anula: marca POSTED→VOID condicionalmente e invierte el saldo', async () => {
    incomeRepository.findById.mockResolvedValue({
      _id: 'inc1',
      companyId: COMPANY,
      amount: 50,
      accountId: ACC,
      status: 'POSTED',
    });
    incomeRepository.markVoided.mockResolvedValue({ _id: 'inc1', status: 'VOID' });
    accountRepository.findById.mockResolvedValue(activeAccount(150));
    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: 100 });
    incomeRepository.getByIdSafe.mockResolvedValue({ _id: 'inc1', status: 'VOID' });

    const result = await incomeService.void('inc1', { reason: 'Cobro duplicado' }, COMPANY, 'user1');

    expect(incomeRepository.markVoided).toHaveBeenCalledWith(
      'inc1',
      { companyId: COMPANY },
      expect.objectContaining({ voidReason: 'Cobro duplicado', voidedBy: 'user1' })
    );
    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, 150, 100);
    expect(result.status).toBe('VOID');
  });

  test('documento ya anulado ⇒ 409 (sin marcar)', async () => {
    incomeRepository.findById.mockResolvedValue({ _id: 'inc1', status: 'VOID' });

    await expect(incomeService.void('inc1', { reason: 'x' }, COMPANY, null)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El registro ya fue anulado.',
    });
    expect(incomeRepository.markVoided).not.toHaveBeenCalled();
  });

  test('carrera de doble anulación: markVoided null ⇒ 409', async () => {
    incomeRepository.findById.mockResolvedValue({ _id: 'inc1', status: 'POSTED' });
    incomeRepository.markVoided.mockResolvedValue(null);

    await expect(incomeService.void('inc1', { reason: 'x' }, COMPANY, null)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El registro ya fue anulado.',
    });
    expect(accountRepository.updateBalance).not.toHaveBeenCalled();
  });

  test('si invertir el saldo falla ⇒ se revierte el marcado y se relanza', async () => {
    incomeRepository.findById.mockResolvedValue({
      _id: 'inc1',
      companyId: COMPANY,
      amount: 50,
      accountId: ACC,
      status: 'POSTED',
    });
    incomeRepository.markVoided.mockResolvedValue({ _id: 'inc1', status: 'VOID' });
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    accountRepository.updateBalance.mockResolvedValue(null);
    incomeRepository.updateById.mockResolvedValue({ _id: 'inc1', status: 'POSTED' });

    await expect(incomeService.void('inc1', { reason: 'x' }, COMPANY, null)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El saldo cambió durante la operación. Intente de nuevo.',
    });
    expect(incomeRepository.updateById).toHaveBeenCalledWith(
      'inc1',
      expect.objectContaining({ status: 'POSTED' }),
      { companyId: COMPANY }
    );
  });

  test('ingreso inexistente (o ajeno) ⇒ 404', async () => {
    incomeRepository.findById.mockResolvedValue(null);
    await expect(incomeService.void('inc1', { reason: 'x' }, COMPANY, null)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
  });
});

describe('expenseService — débitos con saldo', () => {
  test('create: descuenta la cuenta (EXP secuencial)', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    nextSequence.mockResolvedValue(1);
    expenseRepository.create.mockResolvedValue({ _id: 'exp1', code: 'EXP-000001' });
    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: 70 });

    await expenseService.create(
      { amount: 30, category: 'Alquiler', accountId: ACC },
      COMPANY,
      'user1'
    );

    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EXP-000001', status: 'POSTED', amount: 30 })
    );
    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, 100, 70);
  });

  test('sin saldo ⇒ 409 con available y el documento se compensa (borrado)', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount(100));
    nextSequence.mockResolvedValue(2);
    expenseRepository.create.mockResolvedValue({ _id: 'exp2', code: 'EXP-000002' });
    expenseRepository.deleteById.mockResolvedValue({ _id: 'exp2' });

    await expect(
      expenseService.create({ amount: 150, category: 'Equipo', accountId: ACC }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Saldo insuficiente en la cuenta indicado.',
      details: { available: 100 },
    });
    expect(accountRepository.updateBalance).not.toHaveBeenCalled();
    expect(expenseRepository.deleteById).toHaveBeenCalledWith('exp2', { companyId: COMPANY });
  });

  test('proveedor ajeno ⇒ 404 sin consumir numeración', async () => {
    accountRepository.findById.mockResolvedValue(activeAccount());
    supplierRepository.findById.mockResolvedValue(null);

    await expect(
      expenseService.create(
        { amount: 10, category: 'Insumos', accountId: ACC, supplierId: OTHER },
        COMPANY,
        null
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(nextSequence).not.toHaveBeenCalled();
  });

  test('void: repone el dinero descontado', async () => {
    expenseRepository.findById.mockResolvedValue({
      _id: 'exp1',
      companyId: COMPANY,
      amount: 30,
      accountId: ACC,
      status: 'POSTED',
    });
    expenseRepository.markVoided.mockResolvedValue({ _id: 'exp1', status: 'VOID' });
    accountRepository.findById.mockResolvedValue(activeAccount(70));
    accountRepository.updateBalance.mockResolvedValue({ _id: ACC, balance: 100 });
    expenseRepository.getByIdSafe.mockResolvedValue({ _id: 'exp1', status: 'VOID' });

    await expenseService.void('exp1', { reason: 'Pago doble' }, COMPANY, 'user1');

    expect(accountRepository.updateBalance).toHaveBeenCalledWith(COMPANY, ACC, 70, 100);
  });

  test('gasto inexistente ⇒ 404; doble void ⇒ 409', async () => {
    expenseRepository.findById.mockResolvedValue(null);
    await expect(expenseService.void('exp1', { reason: 'x' }, COMPANY, null)).rejects.toMatchObject({
      statusCode: 404,
    });

    expenseRepository.findById.mockResolvedValue({ _id: 'exp1', status: 'VOID' });
    await expect(expenseService.void('exp1', { reason: 'x' }, COMPANY, null)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El registro ya fue anulado.',
    });
  });
});

describe('budgetService — clave única (año, mes, categoría)', () => {
  const KEY = { year: 2026, month: 9, category: 'Alquiler' };

  test('create: clave libre ⇒ crea con createdBy', async () => {
    budgetRepository.findByKey.mockResolvedValue(null);
    budgetRepository.create.mockResolvedValue({ _id: 'b1', ...KEY });

    await budgetService.create({ ...KEY, plannedAmount: 300 }, COMPANY, 'user1');

    expect(budgetRepository.findByKey).toHaveBeenCalledWith(COMPANY, KEY);
    expect(budgetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...KEY, plannedAmount: 300, companyId: COMPANY, createdBy: 'user1' })
    );
  });

  test('duplicado ⇒ 409 canónico con los tres campos', async () => {
    budgetRepository.findByKey.mockResolvedValue({ _id: OTHER });

    await expect(budgetService.create(KEY, COMPANY, null)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ya existe un registro con ese valor en: year, month, category.',
      details: { fields: ['year', 'month', 'category'] },
    });
    expect(budgetRepository.create).not.toHaveBeenCalled();
  });

  test('update: colisión con otro presupuesto ⇒ 409; conservar la propia clave es válido', async () => {
    budgetRepository.findById.mockResolvedValue({ _id: 'b1', ...KEY });

    budgetRepository.findByKey.mockResolvedValue({ _id: OTHER });
    await expect(budgetService.update('b1', { plannedAmount: 400 }, COMPANY)).rejects.toMatchObject({
      statusCode: 409,
    });

    budgetRepository.findByKey.mockResolvedValue({ _id: 'b1' });
    budgetRepository.updateById.mockResolvedValue({ _id: 'b1', plannedAmount: 400 });
    await budgetService.update('b1', { plannedAmount: 400 }, COMPANY);
    expect(budgetRepository.updateById).toHaveBeenCalledWith('b1', { plannedAmount: 400 }, { companyId: COMPANY });
  });

  test('update/remove de presupuesto ajeno ⇒ 404', async () => {
    budgetRepository.findById.mockResolvedValue(null);
    await expect(budgetService.update('b1', { plannedAmount: 1 }, COMPANY)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(budgetService.remove('b1', COMPANY)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('remove existente ⇒ deleteById con tenant', async () => {
    budgetRepository.findById.mockResolvedValue({ _id: 'b1', ...KEY });
    budgetRepository.deleteById.mockResolvedValue({ _id: 'b1' });

    await budgetService.remove('b1', COMPANY);
    expect(budgetRepository.deleteById).toHaveBeenCalledWith('b1', { companyId: COMPANY });
  });
});
