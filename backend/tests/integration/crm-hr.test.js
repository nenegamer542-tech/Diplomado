'use strict';

/**
 * FASE 6 — CRM y RRHH (API + integración).
 *
 * Cubre: leads con ciclo de vida por estado y empleados con documento
 * único, con las reglas del PROMPT:
 *  - RBAC: ventas administra CRM; rrhh administra empleados; gerente sólo
 *    lee CRM/RRHH; consulta no entra (mensajes canónicos 403).
 *  - Ciclo del lead NEW → CONTACTED → QUALIFIED → WON|LOST: transiciones
 *    inválidas ⇒ 409; estado terminal no admite cambios (ADR-012).
 *  - Sin DELETE en ninguno de los dos módulos (la baja es por estado).
 *  - Multiempresa: IDs ajenos ⇒ 404; listados aislados; auditoría POST_CRM /
 *    POST_HR con resourceId.
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

describeIfDb('API /crm/leads y /hr/employees (integración FASE 6)', () => {
  let tenantA;
  let tenantB;
  let adminAToken;
  let ventasToken;
  let rrhhToken;
  let gerenteToken;
  let consultaToken;
  let adminBToken;
  let adminBUserId;

  let leadId;
  let lead2Id;
  let leadBId;
  let employeeId;
  let employeeBId;

  beforeAll(async () => {
    await connectTestDb();

    tenantA = await createTenant({ name: 'CRM-RRHH A' });
    tenantB = await createTenant({ name: 'CRM-RRHH B' });

    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.administrador,
      email: 'admin-crm-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.ventas,
      email: 'ventas-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.rrhh,
      email: 'rrhh-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.gerente,
      email: 'gerente-crm-a@test.local',
    });
    await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.consulta,
      email: 'consulta-crm-a@test.local',
    });
    const adminBUser = await createUser({
      company: tenantB.company,
      branch: tenantB.branch,
      role: tenantB.roles.administrador,
      email: 'admin-crm-b@test.local',
    });
    adminBUserId = String(adminBUser._id);

    adminAToken = await login('admin-crm-a@test.local', 'Clave1234');
    ventasToken = await login('ventas-a@test.local', 'Clave1234');
    rrhhToken = await login('rrhh-a@test.local', 'Clave1234');
    gerenteToken = await login('gerente-crm-a@test.local', 'Clave1234');
    consultaToken = await login('consulta-crm-a@test.local', 'Clave1234');
    adminBToken = await login('admin-crm-b@test.local', 'Clave1234');
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // ----------------------------------------------------------- CRM ---

  test('ventas crea un lead (NEW por defecto, sin asignar)', async () => {
    const res = await request(app)
      .post('/api/v1/crm/leads')
      .set(auth(ventasToken))
      .send({ name: 'Ana Pérez', company: 'ACME', email: 'Ana@Example.com', source: 'web' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('NEW');
    expect(res.body.data.email).toBe('ana@example.com');
    expect(res.body.data.assignedTo).toBeNull();
    expect(res.body.data.expectedAmount).toBe(0);
    leadId = res.body.data._id;
  });

  test('inyección de companyId ⇒ 400 Campos no permitidos', async () => {
    const res = await request(app)
      .post('/api/v1/crm/leads')
      .set(auth(ventasToken))
      .send({ name: 'Inyección', companyId: String(tenantB.company._id) });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Campos no permitidos: companyId.');
  });

  test('consulta NO lee leads ⇒ 403 con mensaje canónico', async () => {
    const res = await request(app).get('/api/v1/crm/leads').set(auth(consultaToken));

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: crm.read.'
    );
  });

  test('gerente LEE leads pero NO los crea ⇒ 403 crm.create', async () => {
    const list = await request(app).get('/api/v1/crm/leads').set(auth(gerenteToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const create = await request(app)
      .post('/api/v1/crm/leads')
      .set(auth(gerenteToken))
      .send({ name: 'No autorizado' });
    expect(create.status).toBe(403);
    expect(create.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: crm.create.'
    );
  });

  test('rrhh NO crea leads ⇒ 403 crm.create', async () => {
    const res = await request(app)
      .post('/api/v1/crm/leads')
      .set(auth(rrhhToken))
      .send({ name: 'No autorizado' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: crm.create.'
    );
  });

  test('transición inválida (NEW → WON directo) ⇒ 409', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/leads/${leadId}`)
      .set(auth(ventasToken))
      .send({ status: 'WON' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('La transición de estado no está permitida.');
  });

  test('ciclo válido NEW → CONTACTED → QUALIFIED → WON', async () => {
    for (const status of ['CONTACTED', 'QUALIFIED', 'WON']) {
      const res = await request(app)
        .patch(`/api/v1/crm/leads/${leadId}`)
        .set(auth(ventasToken))
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
  });

  test('lead cerrado (WON) no admite modificaciones ⇒ 409', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/leads/${leadId}`)
      .set(auth(ventasToken))
      .send({ notes: 'Intento tardío' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('El lead está cerrado; no admite modificaciones.');
  });

  test('sin borrado físico: DELETE de lead ⇒ 404 (ADR-012)', async () => {
    const res = await request(app).delete(`/api/v1/crm/leads/${leadId}`).set(auth(ventasToken));

    expect(res.status).toBe(404);
  });

  test('asignar un lead a un usuario de OTRA empresa ⇒ 404', async () => {
    const created = await request(app)
      .post('/api/v1/crm/leads')
      .set(auth(ventasToken))
      .send({ name: 'Prospecto 2' });
    expect(created.status).toBe(201);
    lead2Id = created.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/crm/leads/${lead2Id}`)
      .set(auth(ventasToken))
      .send({ assignedTo: adminBUserId });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('lead de OTRA empresa ⇒ 404; la empresa B crea el suyo (aislamiento)', async () => {
    const detail = await request(app)
      .get(`/api/v1/crm/leads/${leadId}`)
      .set(auth(adminBToken));
    expect(detail.status).toBe(404);
    expect(detail.body.error.message).toBe('Recurso no encontrado.');

    const created = await request(app)
      .post('/api/v1/crm/leads')
      .set(auth(adminBToken))
      .send({ name: 'Lead B' });
    expect(created.status).toBe(201);
    leadBId = created.body.data._id;

    const listB = await request(app).get('/api/v1/crm/leads').set(auth(adminBToken));
    expect(listB.status).toBe(200);
    expect(listB.body.meta.total).toBe(1);

    const listA = await request(app).get('/api/v1/crm/leads').set(auth(adminAToken));
    expect(listA.status).toBe(200);
    expect(listA.body.meta.total).toBe(2); // lead1 (WON) + lead2
    const ids = listA.body.data.map((l) => l._id);
    expect(ids).not.toContain(leadBId);
  });

  test('la creación del lead queda auditada (POST_CRM con resourceId)', async () => {
    const found = await waitFor(async () => {
      const res = await request(app).get('/api/v1/audit?limit=100').set(auth(adminAToken));
      if (res.status !== 200) return false;
      return res.body.data.some(
        (e) =>
          e.action === 'POST_CRM' &&
          e.resourceId === leadId &&
          e.result === 'SUCCESS' &&
          e.statusCode === 201
      );
    });
    expect(found).toBe(true);
  });

  // ---------------------------------------------------------- RRHH ---

  test('rrhh crea un empleado (active por defecto)', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(rrhhToken))
      .send({
        documentId: '12345678A',
        firstName: 'Ana',
        lastName: 'García',
        department: 'Operaciones',
        position: 'Supervisora',
        salary: 15000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.salary).toBe(15000);
    employeeId = res.body.data._id;
  });

  test('documento duplicado en la misma empresa ⇒ 409 canónico', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(rrhhToken))
      .send({ documentId: '12345678A', firstName: 'Otra', lastName: 'Persona' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya existe un registro con ese valor en: documentId.');
    expect(res.body.error.details.fields).toEqual(['documentId']);
  });

  test('inyección de companyId ⇒ 400 Campos no permitidos', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(rrhhToken))
      .send({ documentId: '99999999Z', firstName: 'Inyección', lastName: 'X', companyId: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Campos no permitidos: companyId.');
  });

  test('gerente LEE empleados pero NO los crea ⇒ 403 hr.create', async () => {
    const list = await request(app).get('/api/v1/hr/employees').set(auth(gerenteToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const create = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(gerenteToken))
      .send({ documentId: '55555555X', firstName: 'No', lastName: 'Autorizado' });
    expect(create.status).toBe(403);
    expect(create.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: hr.create.'
    );
  });

  test('consulta NO lee empleados ⇒ 403 hr.read; ventas NO crea ⇒ 403 hr.create', async () => {
    const list = await request(app).get('/api/v1/hr/employees').set(auth(consultaToken));
    expect(list.status).toBe(403);
    expect(list.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: hr.read.'
    );

    const create = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(ventasToken))
      .send({ documentId: '77777777Y', firstName: 'No', lastName: 'Autorizado' });
    expect(create.status).toBe(403);
    expect(create.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: hr.create.'
    );
  });

  test('baja por status inactive (lifecycle, sin DELETE) y listado filtrado', async () => {
    const patch = await request(app)
      .patch(`/api/v1/hr/employees/${employeeId}`)
      .set(auth(rrhhToken))
      .send({ status: 'inactive', terminationDate: '2026-09-20' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('inactive');

    const inactive = await request(app)
      .get('/api/v1/hr/employees?status=inactive')
      .set(auth(rrhhToken));
    expect(inactive.body.meta.total).toBe(1);

    const active = await request(app)
      .get('/api/v1/hr/employees?status=active')
      .set(auth(rrhhToken));
    expect(active.body.meta.total).toBe(0);
  });

  test('sin borrado físico: DELETE de empleado ⇒ 404 (ADR-012)', async () => {
    const res = await request(app)
      .delete(`/api/v1/hr/employees/${employeeId}`)
      .set(auth(rrhhToken));

    expect(res.status).toBe(404);
  });

  test('empleado de OTRA empresa ⇒ 404; la empresa B crea el suyo (aislamiento)', async () => {
    const detail = await request(app)
      .get(`/api/v1/hr/employees/${employeeId}`)
      .set(auth(adminBToken));
    expect(detail.status).toBe(404);
    expect(detail.body.error.message).toBe('Recurso no encontrado.');

    const created = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(adminBToken))
      .send({ documentId: 'B-0001', firstName: 'Beto', lastName: 'Beta' });
    expect(created.status).toBe(201);
    employeeBId = created.body.data._id;

    const listA = await request(app).get('/api/v1/hr/employees').set(auth(adminAToken));
    expect(listA.body.meta.total).toBe(1);
    expect(listA.body.data.map((e) => e._id)).not.toContain(employeeBId);

    // El mismo documento SÍ es válido en la otra empresa.
    const sameDocInB = await request(app)
      .post('/api/v1/hr/employees')
      .set(auth(adminBToken))
      .send({ documentId: '12345678A', firstName: 'Duplicado', lastName: 'Permitido' });
    expect(sameDocInB.status).toBe(201);
    expect(String(sameDocInB.body.data.companyId)).toBe(String(tenantB.company._id));
  });

  test('la creación del empleado queda auditada (POST_HR con resourceId)', async () => {
    const found = await waitFor(async () => {
      const res = await request(app).get('/api/v1/audit?limit=100').set(auth(adminAToken));
      if (res.status !== 200) return false;
      return res.body.data.some(
        (e) =>
          e.action === 'POST_HR' &&
          e.resourceId === employeeId &&
          e.result === 'SUCCESS' &&
          e.statusCode === 201
      );
    });
    expect(found).toBe(true);
  });
});
