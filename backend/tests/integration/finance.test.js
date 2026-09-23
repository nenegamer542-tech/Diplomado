'use strict';

/**
 * FASE 5 — Finanzas (API + integración).
 *
 * Cubre: cuentas, ingresos/gastos append-only y presupuestos con las reglas
 * del PROMPT:
 *  - RBAC: sólo administrador/finanzas gestionan dinero (mensaje canónico 403);
 *    gerente sólo lee; consulta no entra a finanzas.
 *  - Saldo de cuentas: SÓLO el servidor lo escribe; débitos con saldo
 *    insuficiente ⇒ 409 canónico con `available` y el documento se compensa;
 *    abonos siempre permitidos; anulación invierte el movimiento (ADR-011).
 *  - Append-only: sin PATCH/DELETE (404); doble anulación ⇒ 409.
 *  - Multiempresa: IDs ajenos ⇒ 404; listados aislados; auditoría POST_FINANCE.
 */

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createTenant, createUser, login, auth } = require('../helpers/fixtures');

/** Espera (con reintentos) a que la auditoría no bloqueante se asiente. */
async function waitFor(check, { timeoutMs = 2000, stepMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

describeIfDb('API /finance/* (integración FASE 5)', () => {
  let tenantA;
  let tenantB;
  let adminAToken;
  let finanzasToken;
  let gerenteToken;
  let consultaToken;
  let adminBToken;

  let accAId;
  let accBId;
  let incomeId;
  let budgetId;

  beforeAll(async () => {
    await connectTestDb();

    tenantA = await createTenant({ name: 'Finanzas A' });
    tenantB = await createTenant({ name: 'Finanzas B' });

    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.administrador,
      email: 'admin-fin-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.finanzas,
      email: 'finanzas-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.gerente,
      email: 'gerente-fin-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.consulta,
      email: 'consulta-fin-a@test.local',
    });
    await createUser({
      company: tenantB.company,
      branch: tenantB.branch,
      role: tenantB.roles.administrador,
      email: 'admin-fin-b@test.local',
    });

    adminAToken = await login('admin-fin-a@test.local', 'Clave1234');
    finanzasToken = await login('finanzas-a@test.local', 'Clave1234');
    gerenteToken = await login('gerente-fin-a@test.local', 'Clave1234');
    consultaToken = await login('consulta-fin-a@test.local', 'Clave1234');
    adminBToken = await login('admin-fin-b@test.local', 'Clave1234');
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // ------------------------------------------------------ cuentas ---

  test('finanzas crea una cuenta (código en mayúsculas, saldo 0)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(finanzasToken))
      .send({ code: 'bco-1', name: 'Banco Principal', type: 'bank', currency: 'usd' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('BCO-1');
    expect(res.body.data.currency).toBe('USD');
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.status).toBe('active');
    accAId = res.body.data._id;
  });

  test('código duplicado ⇒ 409 canónico', async () => {
    const res = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(finanzasToken))
      .send({ code: 'BCO-1', name: 'Otra cuenta' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya existe un registro con ese valor en: code.');
    expect(res.body.error.details.fields).toEqual(['code']);
  });

  test('inyección de saldo desde el cliente ⇒ 400 Campos no permitidos', async () => {
    const res = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(finanzasToken))
      .send({ code: 'CAJA-X', name: 'Caja', balance: 9999 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Campos no permitidos: balance.');
  });

  test('consulta NO crea cuentas ⇒ 403 con mensaje canónico', async () => {
    const res = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(consultaToken))
      .send({ code: 'NOPE', name: 'No permitida' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: finance.accounts.create.'
    );
  });

  test('gerente sólo LEE cuentas (listado 200)', async () => {
    const res = await request(app).get('/api/v1/finance/accounts').set(auth(gerenteToken));

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  test('gerente NO actualiza cuentas ⇒ 403 finance.accounts.update', async () => {
    const res = await request(app)
      .patch(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(gerenteToken))
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: finance.accounts.update.'
    );
  });

  test('empresa B crea su propia cuenta (aislamiento)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(adminBToken))
      .send({ code: 'bco-b', name: 'Banco B' });

    expect(res.status).toBe(201);
    accBId = res.body.data._id;
  });

  // ---------------------------------------------------- ingresos ---

  test('finanzas registra un ingreso de 500 (código INC-000001)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/incomes')
      .set(auth(finanzasToken))
      .send({
        amount: 500,
        category: 'Ventas',
        accountId: accAId,
        date: '2026-09-10',
        method: 'transfer',
        description: 'Cobro cliente mayorista',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('INC-000001');
    expect(res.body.data.status).toBe('POSTED');
    expect(res.body.data.amount).toBe(500);
    incomeId = res.body.data._id;
  });

  test('la cuenta refleja el saldo acreditado (500)', async () => {
    const res = await request(app)
      .get(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(finanzasToken));

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(500);
  });

  // ------------------------------------------------------ gastos ---

  test('gasto de 200 ⇒ EXP-000001 y saldo 300', async () => {
    const res = await request(app)
      .post('/api/v1/finance/expenses')
      .set(auth(finanzasToken))
      .send({ amount: 200, category: 'Alquiler', accountId: accAId, date: '2026-09-12' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('EXP-000001');

    const account = await request(app)
      .get(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(finanzasToken));
    expect(account.body.data.balance).toBe(300);
  });

  test('gasto mayor que el saldo ⇒ 409 canónico y SIN dejar documento (compensación)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/expenses')
      .set(auth(finanzasToken))
      .send({ amount: 1000, category: 'Equipo', accountId: accAId });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Saldo insuficiente en la cuenta indicado.');
    expect(res.body.error.details.available).toBe(300);

    const list = await request(app)
      .get('/api/v1/finance/expenses')
      .set(auth(finanzasToken));
    expect(list.body.meta.total).toBe(1); // el intento fallido se compensó
  });

  test('el contador deja un hueco documentado: siguiente gasto EXP-000003', async () => {
    const res = await request(app)
      .post('/api/v1/finance/expenses')
      .set(auth(finanzasToken))
      .send({ amount: 50, category: 'Servicios', accountId: accAId });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('EXP-000003');

    const account = await request(app)
      .get(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(finanzasToken));
    expect(account.body.data.balance).toBe(250);
  });

  // ------------------------------------------- multiempresa/RBAC ---

  test('ingreso con cuenta de OTRA empresa ⇒ 404 (sin consumir numeración)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/incomes')
      .set(auth(finanzasToken))
      .send({ amount: 10, category: 'Ventas', accountId: accBId });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('gerente NO crea ingresos; consulta NO los lee (403 canónicos)', async () => {
    const createRes = await request(app)
      .post('/api/v1/finance/incomes')
      .set(auth(gerenteToken))
      .send({ amount: 10, category: 'Ventas', accountId: accAId });
    expect(createRes.status).toBe(403);
    expect(createRes.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: finance.income.create.'
    );

    const listRes = await request(app)
      .get('/api/v1/finance/incomes')
      .set(auth(consultaToken));
    expect(listRes.status).toBe(403);
    expect(listRes.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: finance.income.read.'
    );
  });

  // --------------------------------------------------- anulación ---

  test('finanzas anula el ingreso: invierte el saldo (queda -250)', async () => {
    const res = await request(app)
      .post(`/api/v1/finance/incomes/${incomeId}/void`)
      .set(auth(finanzasToken))
      .send({ reason: 'Cobro duplicado del cliente' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('VOID');
    expect(res.body.data.voidReason).toBe('Cobro duplicado del cliente');

    const account = await request(app)
      .get(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(finanzasToken));
    expect(account.body.data.balance).toBe(-250); // 250 - 500
  });

  test('doble anulación ⇒ 409 canónico', async () => {
    const res = await request(app)
      .post(`/api/v1/finance/incomes/${incomeId}/void`)
      .set(auth(finanzasToken))
      .send({ reason: 'Otra vez' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('El registro ya fue anulado.');
  });

  test('listado filtrado por status (POSTED/VOID)', async () => {
    const voided = await request(app)
      .get('/api/v1/finance/incomes?status=VOID')
      .set(auth(finanzasToken));
    expect(voided.body.meta.total).toBe(1);

    const posted = await request(app)
      .get('/api/v1/finance/incomes?status=POSTED')
      .set(auth(finanzasToken));
    expect(posted.body.meta.total).toBe(0);
  });

  test('los ABONOS se permiten aunque la cuenta esté en negativo (INC-000002)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/incomes')
      .set(auth(finanzasToken))
      .send({ amount: 100, category: 'Ventas', accountId: accAId });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('INC-000002');

    const account = await request(app)
      .get(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(finanzasToken));
    expect(account.body.data.balance).toBe(-150);
  });

  test('los DÉBITOS exigen saldo: gasto sobre cuenta negativa ⇒ 409 con available', async () => {
    const res = await request(app)
      .post('/api/v1/finance/expenses')
      .set(auth(finanzasToken))
      .send({ amount: 10, category: 'Papelería', accountId: accAId });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Saldo insuficiente en la cuenta indicado.');
    expect(res.body.error.details.available).toBe(-150);

    const list = await request(app)
      .get('/api/v1/finance/expenses')
      .set(auth(finanzasToken));
    expect(list.body.meta.total).toBe(2); // sólo EXP-000001 y EXP-000003
  });

  test('append-only: PATCH y DELETE de ingreso ⇒ 404 (la ruta no existe)', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/finance/incomes/${incomeId}`)
      .set(auth(finanzasToken))
      .send({ amount: 1 });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.message).toBe('Recurso no encontrado.');

    const deleteRes = await request(app)
      .delete(`/api/v1/finance/incomes/${incomeId}`)
      .set(auth(finanzasToken));
    expect(deleteRes.status).toBe(404);
  });

  // ------------------------------------------------- borrado ctas ---

  test('borrar cuenta CON movimientos ⇒ 409 de desactivación', async () => {
    const res = await request(app)
      .delete(`/api/v1/finance/accounts/${accAId}`)
      .set(auth(finanzasToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'La cuenta tiene movimientos: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
    );
  });

  test('borrar cuenta VACÍA ⇒ 200 con deleted:true', async () => {
    const created = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(finanzasToken))
      .send({ code: 'efectivo', name: 'Caja Chica', type: 'cash' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .delete(`/api/v1/finance/accounts/${created.body.data._id}`)
      .set(auth(finanzasToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ _id: created.body.data._id, deleted: true });
  });

  // ------------------------------------------------ presupuestos ---

  test('presupuesto mensual por categoría (clave única)', async () => {
    const res = await request(app)
      .post('/api/v1/finance/budgets')
      .set(auth(finanzasToken))
      .send({ year: 2026, month: 9, category: 'Alquiler', plannedAmount: 300 });

    expect(res.status).toBe(201);
    expect(res.body.data.year).toBe(2026);
    expect(res.body.data.month).toBe(9);
    budgetId = res.body.data._id;
  });

  test('presupuesto duplicado ⇒ 409 canónico de la clave compuesta', async () => {
    const res = await request(app)
      .post('/api/v1/finance/budgets')
      .set(auth(finanzasToken))
      .send({ year: 2026, month: 9, category: 'Alquiler', plannedAmount: 500 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'Ya existe un registro con ese valor en: year, month, category.'
    );
    expect(res.body.error.details.fields).toEqual(['year', 'month', 'category']);
  });

  test('actualizar el importe planeado ⇒ 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/finance/budgets/${budgetId}`)
      .set(auth(finanzasToken))
      .send({ plannedAmount: 350 });

    expect(res.status).toBe(200);
    expect(res.body.data.plannedAmount).toBe(350);
  });

  test('presupuesto ajeno ⇒ 404 y el listado de B queda vacío', async () => {
    const detail = await request(app)
      .get(`/api/v1/finance/budgets/${budgetId}`)
      .set(auth(adminBToken));
    expect(detail.status).toBe(404);
    expect(detail.body.error.message).toBe('Recurso no encontrado.');

    const list = await request(app)
      .get('/api/v1/finance/budgets')
      .set(auth(adminBToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
  });

  test('consulta NO crea presupuestos ⇒ 403 finance.budgets.create', async () => {
    const res = await request(app)
      .post('/api/v1/finance/budgets')
      .set(auth(consultaToken))
      .send({ year: 2026, month: 10, category: 'Varios', plannedAmount: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: finance.budgets.create.'
    );
  });

  // --------------------------------------------------- auditoría ---

  test('la anulación queda auditada (POST_FINANCE con resourceId)', async () => {
    const found = await waitFor(async () => {
      const res = await request(app).get('/api/v1/audit?limit=100').set(auth(adminAToken));
      if (res.status !== 200) return false;
      return res.body.data.some(
        (e) =>
          e.action === 'POST_FINANCE' &&
          e.resourceId === incomeId &&
          e.result === 'SUCCESS' &&
          e.statusCode === 200
      );
    });
    expect(found).toBe(true);
  });
});
