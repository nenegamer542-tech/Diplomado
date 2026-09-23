'use strict';

/**
 * FASE 6 — Producción (API + integración).
 *
 * Cubre: BOM y órdenes de producción con las reglas del PROMPT:
 *  - RBAC: produccion opera; gerente/consulta ni leen producción (403 canónicos).
 *  - Flujo DRAFT → RELEASED → DONE | CANCELLED con asientos de inventario:
 *    release = salidas escaladas con compensación ante stock insuficiente
 *    (409 canónico, la OT NO cambia); done = entrada del producto terminado;
 *    cancel desde RELEASED devuelve el material (ADR-008/013).
 *  - Sin DELETE en BOM ni OT: la baja es por estado (ADR-012).
 *  - Multiempresa: IDs ajenos ⇒ 404; códigos MO/BOM por empresa (ADR-009);
 *    auditoría POST_PRODUCTION con resourceId.
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

describeIfDb('API /production/* (integración FASE 6)', () => {
  let tenantA;
  let tenantB;
  let adminAToken;
  let produccionToken;
  let gerenteToken;
  let consultaToken;
  let ventasToken;
  let adminBToken;

  let warehouseMainId;
  let finId;
  let c1Id;
  let c2Id;
  let bomId;
  let order1Id;
  let order2Id;
  let order3Id;
  let order4Id;

  /** Stock actual de un producto en el almacén MAIN de la empresa A. */
  async function stockA(productId) {
    const res = await request(app)
      .get(`/api/v1/inventory/stock?productId=${productId}&warehouseId=${warehouseMainId}`)
      .set(auth(adminAToken));
    expect(res.status).toBe(200);
    if (!res.body.data.length) return 0;
    return res.body.data[0].quantity;
  }

  beforeAll(async () => {
    await connectTestDb();

    tenantA = await createTenant({ name: 'Producción A' });
    tenantB = await createTenant({ name: 'Producción B' });
    warehouseMainId = String(tenantA.warehouse._id);

    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.administrador,
      email: 'admin-prod-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.produccion,
      email: 'produccion-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.gerente,
      email: 'gerente-prod-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.consulta,
      email: 'consulta-prod-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.ventas,
      email: 'ventas-prod-a@test.local',
    });
    await createUser({
      company: tenantB.company,
      branch: tenantB.branch,
      role: tenantB.roles.administrador,
      email: 'admin-prod-b@test.local',
    });

    adminAToken = await login('admin-prod-a@test.local', 'Clave1234');
    produccionToken = await login('produccion-a@test.local', 'Clave1234');
    gerenteToken = await login('gerente-prod-a@test.local', 'Clave1234');
    consultaToken = await login('consulta-prod-a@test.local', 'Clave1234');
    ventasToken = await login('ventas-prod-a@test.local', 'Clave1234');
    adminBToken = await login('admin-prod-b@test.local', 'Clave1234');

    // Productos (admin) + stock inicial de componentes: C1=100, C2=100.
    const fin = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'FIN-001', name: 'Producto Terminado', unit: 'pza' });
    expect(fin.status).toBe(201);
    finId = fin.body.data._id;

    const c1 = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'COMP-001', name: 'Componente Uno', unit: 'pza' });
    expect(c1.status).toBe(201);
    c1Id = c1.body.data._id;

    const c2 = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'COMP-002', name: 'Componente Dos', unit: 'pza' });
    expect(c2.status).toBe(201);
    c2Id = c2.body.data._id;

    for (const productId of [c1Id, c2Id]) {
      const entry = await request(app)
        .post('/api/v1/inventory/entries')
        .set(auth(adminAToken))
        .send({ productId, warehouseId: warehouseMainId, quantity: 100, reason: 'Semilla FASE 6' });
      expect(entry.status).toBe(201);
    }
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // ------------------------------------------------------------ BOM ---

  test('produccion crea la BOM (BOM-000001, activa con 2 componentes)', async () => {
    const res = await request(app)
      .post('/api/v1/production/boms')
      .set(auth(produccionToken))
      .send({
        productId: finId,
        components: [
          { productId: c1Id, quantity: 2 },
          { productId: c2Id, quantity: 3 },
        ],
        notes: 'Ensamble base',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('BOM-000001');
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.components).toHaveLength(2);
    bomId = res.body.data._id;
  });

  test('inyección de code/companyId en la BOM ⇒ 400 Campos no permitidos', async () => {
    const res = await request(app)
      .post('/api/v1/production/boms')
      .set(auth(produccionToken))
      .send({ productId: finId, components: [{ productId: c1Id, quantity: 1 }], code: 'BOM-999999' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Campos no permitidos: code.');
  });

  test('producto terminado repetido como componente o sin componentes ⇒ 422 canónico', async () => {
    const selfRef = await request(app)
      .post('/api/v1/production/boms')
      .set(auth(produccionToken))
      .send({ productId: finId, components: [{ productId: finId, quantity: 1 }] });
    expect(selfRef.status).toBe(422);
    expect(selfRef.body.error.message).toBe('Los datos enviados no son válidos.');

    const empty = await request(app)
      .post('/api/v1/production/boms')
      .set(auth(produccionToken))
      .send({ productId: finId, components: [] });
    expect(empty.status).toBe(422);
    expect(empty.body.error.message).toBe('Los datos enviados no son válidos.');
  });

  test('BOM con producto de OTRA empresa ⇒ 404 (sin consumir numeración de B)', async () => {
    const res = await request(app)
      .post('/api/v1/production/boms')
      .set(auth(adminBToken))
      .send({ productId: finId, components: [{ productId: c1Id, quantity: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('RBAC: gerente/consulta NO leen producción; ventas NO crea BOM ⇒ 403 canónicos', async () => {
    for (const token of [gerenteToken, consultaToken]) {
      const list = await request(app).get('/api/v1/production/boms').set(auth(token));
      expect(list.status).toBe(403);
      expect(list.body.error.message).toBe(
        'No tiene permisos para esta operación. Se requiere: production.read.'
      );
    }

    const create = await request(app)
      .post('/api/v1/production/boms')
      .set(auth(ventasToken))
      .send({ productId: finId, components: [{ productId: c1Id, quantity: 1 }] });
    expect(create.status).toBe(403);
    expect(create.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: production.create.'
    );
  });

  test('sin borrado físico: DELETE de BOM ⇒ 404 (ADR-012)', async () => {
    const res = await request(app)
      .delete(`/api/v1/production/boms/${bomId}`)
      .set(auth(produccionToken));

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  // --------------------------------------------------- órdenes de producción ---

  test('produccion crea la OT en DRAFT con almacén predeterminado (MO-000001)', async () => {
    const res = await request(app)
      .post('/api/v1/production/orders')
      .set(auth(produccionToken))
      .send({ bomId, quantity: 6 });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('MO-000001');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.quantity).toBe(6);
    expect(res.body.data.lines).toEqual([]);
    expect(String(res.body.data.warehouseId)).toBe(warehouseMainId);
    order1Id = res.body.data._id;
  });

  test('OT con BOM de OTRA empresa ⇒ 404', async () => {
    const res = await request(app)
      .post('/api/v1/production/orders')
      .set(auth(adminBToken))
      .send({ bomId, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('edición sólo en DRAFT (quantity 6 → 4)', async () => {
    const res = await request(app)
      .patch(`/api/v1/production/orders/${order1Id}`)
      .set(auth(produccionToken))
      .send({ quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(4);
  });

  test('release: salidas escaladas (C1=8, C2=12) y snapshot de lines', async () => {
    const res = await request(app)
      .post(`/api/v1/production/orders/${order1Id}/release`)
      .set(auth(produccionToken));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RELEASED');
    expect(res.body.data.lines).toEqual([
      { productId: c1Id, quantity: 8 },
      { productId: c2Id, quantity: 12 },
    ]);
    expect(await stockA(c1Id)).toBe(92); // 100 - 8
    expect(await stockA(c2Id)).toBe(88); // 100 - 12
  });

  test('release repetido ⇒ 409; PATCH fuera de DRAFT ⇒ 409 canónico', async () => {
    const again = await request(app)
      .post(`/api/v1/production/orders/${order1Id}/release`)
      .set(auth(produccionToken));
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('La orden ya fue liberada.');

    const patch = await request(app)
      .patch(`/api/v1/production/orders/${order1Id}`)
      .set(auth(produccionToken))
      .send({ quantity: 10 });
    expect(patch.status).toBe(409);
    expect(patch.body.error.message).toBe('Sólo los documentos en borrador pueden modificarse.');
  });

  test('release sin stock suficiente en la 2ª línea ⇒ 409 canónico + compensación total', async () => {
    const created = await request(app)
      .post('/api/v1/production/orders')
      .set(auth(produccionToken))
      .send({ bomId, quantity: 40 }); // exige C1=80 (hay 92) y C2=120 (hay 88)
    expect(created.status).toBe(201);
    order2Id = created.body.data._id;

    const res = await request(app)
      .post(`/api/v1/production/orders/${order2Id}/release`)
      .set(auth(produccionToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Stock insuficiente en el almacén indicado.');
    expect(res.body.error.details.available).toBe(88);

    // La salida ya hecha de C1 se devolvió: el stock queda como al principio.
    expect(await stockA(c1Id)).toBe(92);
    expect(await stockA(c2Id)).toBe(88);

    const detail = await request(app)
      .get(`/api/v1/production/orders/${order2Id}`)
      .set(auth(produccionToken));
    expect(detail.body.data.status).toBe('DRAFT'); // el estado NO cambió
    expect(detail.body.data.lines).toEqual([]);
  });

  test('done: entrada del producto terminado (FIN = 4)', async () => {
    const res = await request(app)
      .post(`/api/v1/production/orders/${order1Id}/done`)
      .set(auth(produccionToken));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DONE');
    expect(await stockA(finId)).toBe(4);
  });

  test('done repetido ⇒ 409 canónico', async () => {
    const res = await request(app)
      .post(`/api/v1/production/orders/${order1Id}/done`)
      .set(auth(produccionToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('La orden ya fue finalizada.');
  });

  test('cancel desde RELEASED devuelve el material y exige motivo', async () => {
    const created = await request(app)
      .post('/api/v1/production/orders')
      .set(auth(produccionToken))
      .send({ bomId, quantity: 2 });
    expect(created.status).toBe(201);
    order3Id = created.body.data._id;

    const released = await request(app)
      .post(`/api/v1/production/orders/${order3Id}/release`)
      .set(auth(produccionToken));
    expect(released.status).toBe(200);
    expect(await stockA(c1Id)).toBe(88); // 92 - 4
    expect(await stockA(c2Id)).toBe(82); // 88 - 6

    const sinMotivo = await request(app)
      .post(`/api/v1/production/orders/${order3Id}/cancel`)
      .set(auth(produccionToken))
      .send({});
    expect(sinMotivo.status).toBe(422);
    expect(sinMotivo.body.error.message).toBe('Los datos enviados no son válidos.');

    const cancelled = await request(app)
      .post(`/api/v1/production/orders/${order3Id}/cancel`)
      .set(auth(produccionToken))
      .send({ reason: 'Falla de la línea' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.cancelReason).toBe('Falla de la línea');

    // El material liberado en release volvió al almacén.
    expect(await stockA(c1Id)).toBe(92);
    expect(await stockA(c2Id)).toBe(88);
  });

  test('doble cancelación ⇒ 409 canónico', async () => {
    const res = await request(app)
      .post(`/api/v1/production/orders/${order3Id}/cancel`)
      .set(auth(produccionToken))
      .send({ reason: 'Otra vez' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('La orden ya fue cancelada.');
  });

  test('done sin release (DRAFT) ⇒ 409 canónico', async () => {
    const created = await request(app)
      .post('/api/v1/production/orders')
      .set(auth(produccionToken))
      .send({ bomId, quantity: 1 });
    expect(created.status).toBe(201);
    order4Id = created.body.data._id;

    const res = await request(app)
      .post(`/api/v1/production/orders/${order4Id}/done`)
      .set(auth(produccionToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('La orden debe estar liberada antes de finalizarse.');
  });

  test('sin borrado físico: DELETE de OT ⇒ 404 (ADR-012)', async () => {
    const res = await request(app)
      .delete(`/api/v1/production/orders/${order1Id}`)
      .set(auth(produccionToken));

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('RBAC: produccion lista las OT; gerente/consulta reciben 403 canónico', async () => {
    const list = await request(app)
      .get('/api/v1/production/orders')
      .set(auth(produccionToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(4); // MO-000001..MO-000004 de la empresa A

    for (const token of [gerenteToken, consultaToken]) {
      const denied = await request(app).get('/api/v1/production/orders').set(auth(token));
      expect(denied.status).toBe(403);
      expect(denied.body.error.message).toBe(
        'No tiene permisos para esta operación. Se requiere: production.read.'
      );
    }
  });

  test('multiempresa: la OT de A es 404 para B y su listado queda vacío', async () => {
    const detail = await request(app)
      .get(`/api/v1/production/orders/${order1Id}`)
      .set(auth(adminBToken));
    expect(detail.status).toBe(404);
    expect(detail.body.error.message).toBe('Recurso no encontrado.');

    const list = await request(app)
      .get('/api/v1/production/orders')
      .set(auth(adminBToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
  });

  test('la creación de la OT queda auditada (POST_PRODUCTION con resourceId)', async () => {
    const found = await waitFor(async () => {
      const res = await request(app).get('/api/v1/audit?limit=100').set(auth(adminAToken));
      if (res.status !== 200) return false;
      return res.body.data.some(
        (e) =>
          e.action === 'POST_PRODUCTION' &&
          e.resourceId === order1Id &&
          e.result === 'SUCCESS' &&
          e.statusCode === 201
      );
    });
    expect(found).toBe(true);
  });
});
