'use strict';

/**
 * FASE 5 — Reportes (API + integración).
 *
 * Los datos de entrada se siembran con REPOSITORIES (sin pasar por los
 * services) para acoplar la prueba sólo a la agregación consultada.
 * Cubre: KPI, ventas/compras por estado, inventario valorizado, finanzas
 * por mes/año/histórico, presupuesto vs ejecutado, validaciones 422,
 * export CSV (reports.export) y aislamiento multiempresa (empresa B en ceros).
 */

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createTenant, createUser, login, auth } = require('../helpers/fixtures');
const accountRepository = require('../../src/modules/accounts/account.repository');
const incomeRepository = require('../../src/modules/incomes/income.repository');
const expenseRepository = require('../../src/modules/expenses/expense.repository');
const budgetRepository = require('../../src/modules/budgets/budget.repository');
const productRepository = require('../../src/modules/products/product.repository');
const supplierRepository = require('../../src/modules/suppliers/supplier.repository');
const customerRepository = require('../../src/modules/customers/customer.repository');
const stockLevelRepository = require('../../src/modules/inventory/stock_level.repository');
const purchaseOrderRepository = require('../../src/modules/purchase-orders/purchase_order.repository');
const salesOrderRepository = require('../../src/modules/sales-orders/sales_order.repository');

describeIfDb('API /reports/* (integración FASE 5)', () => {
  let tenantA;
  let tenantB;
  let adminAToken;
  let consultaToken;
  let ventasToken;
  let adminBToken;

  beforeAll(async () => {
    await connectTestDb();

    tenantA = await createTenant({ name: 'Reportes A' });
    tenantB = await createTenant({ name: 'Reportes B' });

    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.administrador,
      email: 'admin-rpt-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.consulta,
      email: 'consulta-rpt-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.ventas,
      email: 'ventas-rpt-a@test.local',
    });
    await createUser({
      company: tenantB.company,
      branch: tenantB.branch,
      role: tenantB.roles.administrador,
      email: 'admin-rpt-b@test.local',
    });

    adminAToken = await login('admin-rpt-a@test.local', 'Clave1234');
    consultaToken = await login('consulta-rpt-a@test.local', 'Clave1234');
    ventasToken = await login('ventas-rpt-a@test.local', 'Clave1234');
    adminBToken = await login('admin-rpt-b@test.local', 'Clave1234');

    await seedReportData(tenantA);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  /** Datos deterministas de la empresa A (fechas explícitas y conocidas). */
  async function seedReportData(tenant) {
    const cid = tenant.company._id;
    const wid = tenant.warehouse._id;

    const account = await accountRepository.create({
      companyId: cid,
      code: 'BCO-R',
      name: 'Banco Reportes',
      type: 'bank',
      currency: 'USD',
      balance: 1130,
      status: 'active',
    });

    const productA = await productRepository.create({
      companyId: cid,
      sku: 'RPT-A',
      name: 'Producto A',
      unit: 'pza',
      costPrice: 10,
      salePrice: 15,
      minStock: 10, // 5 <= 10 ⇒ stock bajo
      status: 'active',
    });
    const productB = await productRepository.create({
      companyId: cid,
      sku: 'RPT-B',
      name: 'Producto B',
      unit: 'pza',
      costPrice: 5,
      salePrice: 8,
      minStock: 0,
      status: 'active',
    });
    await stockLevelRepository.create({
      companyId: cid,
      warehouseId: wid,
      productId: productA._id,
      quantity: 5,
    });
    await stockLevelRepository.create({
      companyId: cid,
      warehouseId: wid,
      productId: productB._id,
      quantity: 3,
    });

    const supplier = await supplierRepository.create({
      companyId: cid,
      code: 'RPT-PROV',
      name: 'Proveedor Reportes',
      status: 'active',
    });
    const customer = await customerRepository.create({
      companyId: cid,
      code: 'RPT-CLI',
      name: 'Cliente Reportes',
      status: 'active',
    });

    const poLine = [{ productId: productA._id, quantity: 1, unitCost: 30 }];
    await purchaseOrderRepository.create({
      companyId: cid,
      code: 'PO-000001',
      supplierId: supplier._id,
      warehouseId: wid,
      status: 'APPROVED',
      lines: poLine,
      total: 30,
    });
    await purchaseOrderRepository.create({
      companyId: cid,
      code: 'PO-000002',
      supplierId: supplier._id,
      warehouseId: wid,
      status: 'REJECTED',
      lines: poLine,
      total: 10,
      rejectionReason: 'Precio fuera de mercado',
    });

    const soLine = [{ productId: productA._id, quantity: 2, unitPrice: 30 }];
    await salesOrderRepository.create({
      companyId: cid,
      code: 'SO-000001',
      customerId: customer._id,
      warehouseId: wid,
      status: 'APPROVED',
      lines: soLine,
      total: 60,
    });
    await salesOrderRepository.create({
      companyId: cid,
      code: 'SO-000002',
      customerId: customer._id,
      warehouseId: wid,
      status: 'DRAFT',
      lines: soLine,
      total: 40,
    });

    const mkIncome = (code, amount, date, category) =>
      incomeRepository.create({
        companyId: cid,
        code,
        amount,
        date: new Date(date),
        category,
        method: 'transfer',
        accountId: account._id,
        status: 'POSTED',
      });
    const mkExpense = (code, amount, date, category) =>
      expenseRepository.create({
        companyId: cid,
        code,
        amount,
        date: new Date(date),
        category,
        method: 'transfer',
        accountId: account._id,
        status: 'POSTED',
      });

    // Histórico: julio, agosto y septiembre de 2026.
    await mkIncome('INC-000001', 1000, '2026-09-10T12:00:00.000Z', 'Ventas');
    await mkIncome('INC-000002', 500, '2026-08-15T12:00:00.000Z', 'Ventas');
    await mkExpense('EXP-000001', 250, '2026-09-12T12:00:00.000Z', 'Alquiler');
    await mkExpense('EXP-000002', 100, '2026-07-05T12:00:00.000Z', 'Servicios');
    await mkExpense('EXP-000003', 20, '2026-09-15T12:00:00.000Z', 'Varios');

    await budgetRepository.create({
      companyId: cid,
      year: 2026,
      month: 9,
      category: 'Alquiler',
      plannedAmount: 300,
    });
    await budgetRepository.create({
      companyId: cid,
      year: 2026,
      month: 9,
      category: 'Servicios',
      plannedAmount: 50,
    });
  }

  // ------------------------------------------------------------ KPI ---

  test('consulta obtiene los KPI globales', async () => {
    const res = await request(app).get('/api/v1/reports/kpis').set(auth(consultaToken));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.sales).toEqual({ count: 1, total: 60 });
    expect(data.purchases).toEqual({ count: 1, total: 30 });
    expect(data.income).toEqual({ count: 2, total: 1500 });
    expect(data.expense).toEqual({ count: 3, total: 370 });
    expect(data.net).toBe(1130);
    expect(data.catalog).toEqual({ products: 2, customers: 1, suppliers: 1, lowStock: 1 });
  });

  test('ventas puede leer KPI (reports.read)', async () => {
    const res = await request(app).get('/api/v1/reports/kpis').set(auth(ventasToken));

    expect(res.status).toBe(200);
    expect(res.body.data.net).toBe(1130);
  });

  test('ventas NO exporta ⇒ 403 canónico reports.export', async () => {
    const res = await request(app)
      .get('/api/v1/reports/finance/export')
      .set(auth(ventasToken));

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: reports.export.'
    );
  });

  // ------------------------------------------------ reportes venta ---

  test('reporte de ventas por estado y serie mensual', async () => {
    const res = await request(app).get('/api/v1/reports/sales').set(auth(consultaToken));

    expect(res.status).toBe(200);
    const { byStatus, byMonth } = res.body.data;
    const approved = byStatus.find((r) => r.status === 'APPROVED');
    const draft = byStatus.find((r) => r.status === 'DRAFT');
    expect(approved).toMatchObject({ count: 1, total: 60 });
    expect(draft).toMatchObject({ count: 1, total: 40 });
    expect(byMonth.length).toBeGreaterThanOrEqual(1);
    expect(byMonth[0].count).toBeGreaterThanOrEqual(1);
  });

  test('reporte de compras por estado', async () => {
    const res = await request(app).get('/api/v1/reports/purchases').set(auth(consultaToken));

    expect(res.status).toBe(200);
    const byStatus = res.body.data.byStatus;
    expect(byStatus.find((r) => r.status === 'APPROVED')).toMatchObject({ count: 1, total: 30 });
    expect(byStatus.find((r) => r.status === 'REJECTED')).toMatchObject({ count: 1, total: 10 });
  });

  // ------------------------------------------------- inventario ---

  test('inventario valorizado a costo + stock bajo', async () => {
    const res = await request(app).get('/api/v1/reports/inventory').set(auth(consultaToken));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalQuantity).toBe(8); // 5 + 3
    expect(data.totalValue).toBe(65); // 5×10 + 3×5
    expect(data.lowStock).toBe(1); // sólo RPT-A (5 <= 10)
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({ sku: 'RPT-A', quantity: 5, costPrice: 10, value: 50 });
  });

  // -------------------------------------------------- finanzas ---

  test('finanzas del mes (sólo septiembre)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/finance?year=2026&month=9')
      .set(auth(consultaToken));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.income).toEqual({ count: 1, total: 1000 });
    expect(data.expense).toEqual({ count: 2, total: 270 }); // 250 + 20
    expect(data.net).toBe(730);
    expect(data.incomeByCategory[0]).toMatchObject({ category: 'Ventas', total: 1000 });
    expect(data.cash.accountsBalance).toBe(1130);
    expect(data.cash.accounts[0]).toMatchObject({ code: 'BCO-R', balance: 1130 });
  });

  test('finanzas del año (agosto+septiembre; julio fuera)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/finance?year=2026')
      .set(auth(consultaToken));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.income).toEqual({ count: 2, total: 1500 });
    expect(data.expense).toEqual({ count: 3, total: 370 }); // ano calendario completo
    expect(data.net).toBe(1130);
  });

  test('finanzas histórico completo (sin filtros)', async () => {
    const res = await request(app).get('/api/v1/reports/finance').set(auth(consultaToken));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.income).toEqual({ count: 2, total: 1500 });
    expect(data.expense).toEqual({ count: 3, total: 370 });
    expect(data.net).toBe(1130);
  });

  // ------------------------------------------------ presupuestos ---

  test('presupuesto vs ejecutado (vista mensual, incluye categoría sin presupuesto)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/budgets?year=2026&month=9')
      .set(auth(consultaToken));

    expect(res.status).toBe(200);
    const { items, totals } = res.body.data;
    expect(items).toHaveLength(3);
    expect(totals).toEqual({ planned: 350, executed: 270, variance: 80 });

    const alquiler = items.find((i) => i.category === 'Alquiler');
    expect(alquiler).toMatchObject({ planned: 300, actual: 250, variance: 50, utilization: 83.33 });

    const servicios = items.find((i) => i.category === 'Servicios');
    expect(servicios).toMatchObject({ planned: 50, actual: 0, variance: 50, utilization: 0 });

    const varios = items.find((i) => i.category === 'Varios');
    expect(varios).toMatchObject({ planned: 0, actual: 20, variance: -20, utilization: null });
  });

  test('presupuesto anual: planeado agregado por categoría y ejecutado del año', async () => {
    const res = await request(app)
      .get('/api/v1/reports/budgets?year=2026')
      .set(auth(consultaToken));

    expect(res.status).toBe(200);
    const { items, totals } = res.body.data;
    expect(totals).toEqual({ planned: 350, executed: 370, variance: -20 });

    const servicios = items.find((i) => i.category === 'Servicios');
    expect(servicios).toMatchObject({ planned: 50, actual: 100, variance: -50 }); // julio + septiembre
  });

  // ------------------------------------------------ validación ---

  test('presupuestos SIN year ⇒ 422 (Los datos enviados no son válidos.)', async () => {
    const res = await request(app).get('/api/v1/reports/budgets').set(auth(consultaToken));

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
  });

  test('rango invertido (from > to) ⇒ 422', async () => {
    const res = await request(app)
      .get('/api/v1/reports/kpis?from=2026-09-30&to=2026-09-01')
      .set(auth(consultaToken));

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
  });

  test('query estricta: parámetro desconocido en reportes ⇒ 422', async () => {
    const res = await request(app)
      .get('/api/v1/reports/kpis?page=2')
      .set(auth(consultaToken));

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
  });

  // ----------------------------------------------------- export ---

  test('export CSV (reports.export): BOM UTF-8, encabezado y códigos', async () => {
    const res = await request(app)
      .get('/api/v1/reports/finance/export')
      .set(auth(adminAToken));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="movimientos-financieros-.*\.csv"/);

    const text = res.text;
    expect(text.startsWith('\uFEFFtipo,codigo,fecha')).toBe(true);
    expect(text).toContain('INC-000001');
    expect(text).toContain('EXP-000001');
    expect(text).toContain('BCO-R');
    expect(text).toContain('INGRESO');
    expect(text).toContain('GASTO');
  });

  // ------------------------------------------------ multiempresa ---

  test('empresa B: KPI en ceros (sin fugas de datos)', async () => {
    const res = await request(app).get('/api/v1/reports/kpis').set(auth(adminBToken));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.sales).toEqual({ count: 0, total: 0 });
    expect(data.purchases).toEqual({ count: 0, total: 0 });
    expect(data.income).toEqual({ count: 0, total: 0 });
    expect(data.expense).toEqual({ count: 0, total: 0 });
    expect(data.net).toBe(0);
    expect(data.catalog).toEqual({ products: 0, customers: 0, suppliers: 0, lowStock: 0 });
  });

  test('empresa B: inventario y finanzas vacíos', async () => {
    const inv = await request(app).get('/api/v1/reports/inventory').set(auth(adminBToken));
    expect(inv.status).toBe(200);
    expect(inv.body.data.totalValue).toBe(0);
    expect(inv.body.data.items).toEqual([]);

    const fin = await request(app)
      .get('/api/v1/reports/finance?year=2026&month=9')
      .set(auth(adminBToken));
    expect(fin.status).toBe(200);
    expect(fin.body.data.income).toEqual({ count: 0, total: 0 });
    expect(fin.body.data.cash.accountsBalance).toBe(0);
  });

  test('sin token ⇒ 401', async () => {
    const res = await request(app).get('/api/v1/reports/kpis');
    expect(res.status).toBe(401);
  });
});
