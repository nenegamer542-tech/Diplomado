'use strict';

/**
 * Validación Zod de FASE 5 (finanzas/reportes):
 * cuentas, ingresos/gastos append-only, presupuestos y consultas de reportes.
 */

const accountSchemas = require('../../src/modules/accounts/account.validation');
const incomeSchemas = require('../../src/modules/incomes/income.validation');
const expenseSchemas = require('../../src/modules/expenses/expense.validation');
const budgetSchemas = require('../../src/modules/budgets/budget.validation');
const reportSchemas = require('../../src/modules/reports/report.validation');

const ACCOUNT_ID = '64b000000000000000000201';
const CUSTOMER_ID = '64b000000000000000000202';
const SUPPLIER_ID = '64b000000000000000000203';

describe('Cuenta financiera — createSchema', () => {
  test('payload mínimo y completo pasan (currency se normaliza)', () => {
    expect(accountSchemas.createSchema.safeParse({ code: 'BCO-1', name: 'Banco' }).success).toBe(true);
    const full = accountSchemas.createSchema.safeParse({
      code: 'caja_01',
      name: 'Caja Chica',
      type: 'cash',
      currency: 'usd',
      status: 'active',
      notes: 'Caja del piso 1',
    });
    expect(full.success).toBe(true);
    expect(full.data.currency).toBe('USD');
  });

  test('código inválido, nombre corto, type/currency/status fuera de enum ⇒ inválido', () => {
    expect(accountSchemas.createSchema.safeParse({ code: 'a b', name: 'Caja' }).success).toBe(false);
    expect(accountSchemas.createSchema.safeParse({ code: 'CAJA', name: 'X' }).success).toBe(false);
    expect(accountSchemas.createSchema.safeParse({ code: 'CAJA', name: 'Caja', type: 'crypto' }).success).toBe(false);
    expect(accountSchemas.createSchema.safeParse({ code: 'CAJA', name: 'Caja', currency: 'US' }).success).toBe(false);
    expect(accountSchemas.createSchema.safeParse({ code: 'CAJA', name: 'Caja', status: 'archived' }).success).toBe(false);
  });

  test('schema estricto: companyId/balance inyectados ⇒ inválido; balance fuera de CREATE_FIELDS', () => {
    expect(
      accountSchemas.createSchema.safeParse({
        code: 'CAJA',
        name: 'Caja',
        companyId: '64b000000000000000000001',
      }).success
    ).toBe(false);
    expect(
      accountSchemas.createSchema.safeParse({ code: 'CAJA', name: 'Caja', balance: 9999 }).success
    ).toBe(false);
    expect(accountSchemas.CREATE_FIELDS).not.toContain('balance');
    expect(accountSchemas.CREATE_FIELDS).not.toContain('companyId');
  });

  test('PATCH parcial estricto: vacío ⇒ inválido', () => {
    expect(accountSchemas.updateSchema.safeParse({ name: 'Otro Nombre' }).success).toBe(true);
    expect(accountSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(accountSchemas.updateSchema.safeParse({ balance: 100 }).success).toBe(false);
  });

  test('listQuery: enums y paginación coercida', () => {
    expect(accountSchemas.listQuery.safeParse({ status: 'active', type: 'bank', page: '2' }).success).toBe(true);
    expect(accountSchemas.listQuery.safeParse({ status: 'frozen' }).success).toBe(false);
    expect(accountSchemas.listQuery.safeParse({ type: 'crypto' }).success).toBe(false);
    expect(accountSchemas.listQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('Ingreso — createSchema / voidSchema', () => {
  test('payload mínimo válido (amount > 0, cuenta obligatoria)', () => {
    const result = incomeSchemas.createSchema.safeParse({
      amount: 150.5,
      category: 'Ventas',
      accountId: ACCOUNT_ID,
    });
    expect(result.success).toBe(true);
  });

  test('amount 0/negativo, cuenta inválida o método fuera de enum ⇒ inválido', () => {
    const base = { category: 'Ventas', accountId: ACCOUNT_ID };
    expect(incomeSchemas.createSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(incomeSchemas.createSchema.safeParse({ ...base, amount: -10 }).success).toBe(false);
    expect(incomeSchemas.createSchema.safeParse({ ...base, amount: 10, accountId: 'no-oid' }).success).toBe(false);
    expect(
      incomeSchemas.createSchema.safeParse({ ...base, amount: 10, method: 'bitcoin' }).success
    ).toBe(false);
  });

  test('schema estricto: status/code/companyId del cliente ⇒ inválido', () => {
    const base = { amount: 10, category: 'Ventas', accountId: ACCOUNT_ID };
    expect(incomeSchemas.createSchema.safeParse({ ...base, status: 'VOID' }).success).toBe(false);
    expect(incomeSchemas.createSchema.safeParse({ ...base, code: 'INC-999999' }).success).toBe(false);
    expect(incomeSchemas.createSchema.safeParse({ ...base, companyId: 'x' }).success).toBe(false);
    expect(incomeSchemas.CREATE_FIELDS).not.toContain('status');
    expect(incomeSchemas.CREATE_FIELDS).not.toContain('code');
    expect(incomeSchemas.CREATE_FIELDS).not.toContain('companyId');
  });

  test('la fecha del cliente se acepta y coercece a Date', () => {
    const result = incomeSchemas.createSchema.safeParse({
      amount: 10,
      category: 'Ventas',
      accountId: ACCOUNT_ID,
      date: '2026-09-10T12:00:00.000Z',
      customerId: CUSTOMER_ID,
    });
    expect(result.success).toBe(true);
    expect(result.data.date).toBeInstanceOf(Date);
  });

  test('void: exige reason (>=2), estricto y VOID_FIELDS = ["reason"]', () => {
    expect(incomeSchemas.voidSchema.safeParse({ reason: 'Cobro duplicado' }).success).toBe(true);
    expect(incomeSchemas.voidSchema.safeParse({}).success).toBe(false);
    expect(incomeSchemas.voidSchema.safeParse({ reason: 'x' }).success).toBe(false);
    expect(incomeSchemas.voidSchema.safeParse({ reason: 'ok', amount: 10 }).success).toBe(false);
    expect(incomeSchemas.VOID_FIELDS).toEqual(['reason']);
  });

  test('listQuery: status POSTED/VOID, filtros de cuenta y rango de fechas', () => {
    expect(incomeSchemas.listQuery.safeParse({ status: 'POSTED', accountId: ACCOUNT_ID }).success).toBe(true);
    expect(incomeSchemas.listQuery.safeParse({ status: 'CANCELLED' }).success).toBe(false);
    expect(incomeSchemas.listQuery.safeParse({ from: '2026-09-01', to: '2026-09-30' }).success).toBe(true);
    expect(incomeSchemas.listQuery.safeParse({ from: 'ayer' }).success).toBe(false);
  });
});

describe('Gasto — createSchema', () => {
  test('payload válido con proveedor opcional; mismas reglas que ingresos', () => {
    expect(
      expenseSchemas.createSchema.safeParse({
        amount: 80,
        category: 'Alquiler',
        accountId: ACCOUNT_ID,
        supplierId: SUPPLIER_ID,
      }).success
    ).toBe(true);
    expect(
      expenseSchemas.createSchema.safeParse({ amount: -1, category: 'Alquiler', accountId: ACCOUNT_ID })
        .success
    ).toBe(false);
    expect(
      expenseSchemas.createSchema.safeParse({
        amount: 10,
        category: 'Alquiler',
        accountId: ACCOUNT_ID,
        status: 'POSTED',
      }).success
    ).toBe(false);
    expect(expenseSchemas.CREATE_FIELDS).not.toContain('status');
    expect(expenseSchemas.VOID_FIELDS).toEqual(['reason']);
    expect(expenseSchemas.voidSchema.safeParse({ reason: 'Pago doble' }).success).toBe(true);
    expect(expenseSchemas.voidSchema.safeParse({}).success).toBe(false);
  });
});

describe('Presupuesto — createSchema / updateSchema', () => {
  test('payload válido (year/month coercidos a enteros)', () => {
    const result = budgetSchemas.createSchema.safeParse({
      year: '2026',
      month: '9',
      category: 'Alquiler',
      plannedAmount: 300,
    });
    expect(result.success).toBe(true);
    expect(result.data.year).toBe(2026);
    expect(result.data.month).toBe(9);
  });

  test('año fuera de rango, mes 0/13 o importe negativo ⇒ inválido', () => {
    const base = { category: 'Alquiler', plannedAmount: 100 };
    expect(budgetSchemas.createSchema.safeParse({ ...base, year: 1999, month: 5 }).success).toBe(false);
    expect(budgetSchemas.createSchema.safeParse({ ...base, year: 2101, month: 5 }).success).toBe(false);
    expect(budgetSchemas.createSchema.safeParse({ ...base, year: 2026, month: 0 }).success).toBe(false);
    expect(budgetSchemas.createSchema.safeParse({ ...base, year: 2026, month: 13 }).success).toBe(false);
    expect(budgetSchemas.createSchema.safeParse({ ...base, year: 2026, month: 9, plannedAmount: -1 }).success).toBe(false);
  });

  test('PATCH parcial estricto no vacío; listQuery con year/month coercidos', () => {
    expect(budgetSchemas.updateSchema.safeParse({ plannedAmount: 500 }).success).toBe(true);
    expect(budgetSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(budgetSchemas.listQuery.safeParse({ year: '2026', month: '9' }).success).toBe(true);
    expect(budgetSchemas.listQuery.safeParse({ month: 14 }).success).toBe(false);
    expect(budgetSchemas.CREATE_FIELDS).not.toContain('companyId');
    expect(budgetSchemas.CREATE_FIELDS).not.toContain('actual');
  });
});

describe('Consultas de reportes', () => {
  test('rangeQuery: fechas coerceidas y from <= to', () => {
    const ok = reportSchemas.rangeQuery.safeParse({ from: '2026-09-01', to: '2026-09-30' });
    expect(ok.success).toBe(true);
    expect(ok.data.from).toBeInstanceOf(Date);
    expect(reportSchemas.rangeQuery.safeParse({}).success).toBe(true);
    expect(reportSchemas.rangeQuery.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success).toBe(false);
    expect(reportSchemas.rangeQuery.safeParse({ from: 'ayer' }).success).toBe(false);
  });

  test('rangeQuery estricto: parámetros desconocidos (page) ⇒ inválido', () => {
    expect(reportSchemas.rangeQuery.safeParse({ page: 2 }).success).toBe(false);
    expect(reportSchemas.financeQuery.safeParse({ search: 'x' }).success).toBe(false);
  });

  test('financeQuery: year/month/rango; month fuera de 1..12 ⇒ inválido', () => {
    expect(reportSchemas.financeQuery.safeParse({ year: 2026, month: 9 }).success).toBe(true);
    expect(reportSchemas.financeQuery.safeParse({ year: 2026 }).success).toBe(true);
    expect(reportSchemas.financeQuery.safeParse({ month: 13 }).success).toBe(false);
    expect(reportSchemas.financeQuery.safeParse({ year: 1999 }).success).toBe(false);
  });

  test('budgetsQuery: year OBLIGATORIO; month opcional acotado', () => {
    expect(reportSchemas.budgetsQuery.safeParse({ year: 2026 }).success).toBe(true);
    expect(reportSchemas.budgetsQuery.safeParse({ year: 2026, month: 12 }).success).toBe(true);
    expect(reportSchemas.budgetsQuery.safeParse({}).success).toBe(false);
    expect(reportSchemas.budgetsQuery.safeParse({ year: 2026, month: 0 }).success).toBe(false);
  });
});
