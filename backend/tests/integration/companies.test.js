'use strict';

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createPlatformSuperAdmin, login, auth } = require('../helpers/fixtures');
const MasterData = require('../../src/modules/master-data/master_data.model');

describeIfDb('API /companies (integración, rol plataforma)', () => {
  let superToken;
  let gamma; // empresa creada vía API
  let gammaAdminId;

  beforeAll(async () => {
    await connectTestDb();
    await createPlatformSuperAdmin();
    superToken = await login('superadmin@test.local', 'Clave1234');
  });

  afterAll(async () => {
    await closeTestDb();
  });

  test('POST /companies sin autenticación → 401', async () => {
    const res = await request(app).post('/api/v1/companies').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  test('Super Admin crea empresa → aprovisiona sucursal, almacén y 10 roles', async () => {
    const res = await request(app)
      .post('/api/v1/companies')
      .set(auth(superToken))
      .send({ name: 'Empresa Gamma', currency: 'MXN', taxId: 'XAXX010101000' });

    expect(res.status).toBe(201);
    const { company, branch, warehouse, roles } = res.body.data;
    expect(company.status).toBe('active');
    expect(company.currencyId).toBeTruthy();
    expect(await MasterData.exists({ _id: company.currencyId, companyId: company._id, type: 'currency', code: 'MXN' })).toBeTruthy();
    expect(branch.code).toBe('MAIN');
    expect(branch.isDefault).toBe(true);
    expect(String(branch.companyId)).toBe(String(company._id));
    // FASE 3: toda empresa nueva queda con almacén MAIN vinculado a su sucursal.
    expect(warehouse.code).toBe('MAIN');
    expect(warehouse.isDefault).toBe(true);
    expect(String(warehouse.companyId)).toBe(String(company._id));
    expect(String(warehouse.branchId)).toBe(String(branch._id));
    expect(roles).toHaveLength(10);
    expect(roles.map((r) => r.code)).toContain('administrador');
    for (const r of roles) expect(r.isSystem).toBe(true);

    gamma = company;
  });

  test('nombre de empresa duplicado → 409 con mensaje canónico', async () => {
    const res = await request(app)
      .post('/api/v1/companies')
      .set(auth(superToken))
      .send({ name: 'Empresa Gamma' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya existe un registro con ese valor en: name.');
  });

  test('Super Admin lista y lee cualquier empresa', async () => {
    const list = await request(app).get('/api/v1/companies?limit=100').set(auth(superToken));
    expect(list.status).toBe(200);
    expect(list.body.data.map((c) => c.name)).toContain('Empresa Gamma');

    const get = await request(app)
      .get(`/api/v1/companies/${gamma._id}`)
      .set(auth(superToken));
    expect(get.status).toBe(200);
    expect(get.body.data._id).toBe(String(gamma._id));
  });

  test('Super Admin crea el administrador de la empresa nueva', async () => {
    const rolesRes = await request(app)
      .get(`/api/v1/roles?companyId=${gamma._id}`)
      .set(auth(superToken));
    expect(rolesRes.status).toBe(200);
    const adminRole = rolesRes.body.data.find((r) => r.code === 'administrador');
    expect(adminRole).toBeDefined();

    const userRes = await request(app)
      .post('/api/v1/users')
      .set(auth(superToken))
      .send({
        companyId: String(gamma._id),
        name: 'Gamma',
        lastName: 'Admin',
        email: 'admin@gamma.local',
        password: 'Clave1234',
        roleId: String(adminRole._id),
      });

    expect(userRes.status).toBe(201);
    expect(userRes.body.data.companyId).toBe(String(gamma._id));
    expect(userRes.body.data.passwordHash).toBeUndefined();
    gammaAdminId = userRes.body.data._id;
  });

  test('no se puede desactivar al ÚLTIMO administrador de la empresa', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${gammaAdminId}`)
      .set(auth(superToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'No es posible desactivar al último administrador activo de la empresa.'
    );
  });

  test('DELETE /companies = suspensión lógica y el login de la empresa cae', async () => {
    // La empresa sigue activa: el admin entra.
    const before = await login('admin@gamma.local', 'Clave1234');
    expect(before).toBeDefined();

    const del = await request(app)
      .delete(`/api/v1/companies/${gamma._id}`)
      .set(auth(superToken));
    expect(del.status).toBe(200);
    expect(del.body.data.status).toBe('suspended');

    // Ningún usuario de la empresa suspendida puede entrar.
    const after = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@gamma.local', password: 'Clave1234' });
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('COMPANY_SUSPENDED');
  });

  test('la suspensión queda auditada (alcance de plataforma)', async () => {
    const res = await request(app)
      .get('/api/v1/audit?limit=100&allCompanies=true')
      .set(auth(superToken));
    expect(res.status).toBe(200);

    // El Super Admin no tiene tenant: su bitácora es la de plataforma (companyId null).
    const suspensions = res.body.data.filter(
      (e) => e.module === 'companies' && e.action === 'DELETE_COMPANIES' && e.result === 'SUCCESS'
    );
    expect(suspensions.length).toBe(1);
    for (const entry of res.body.data) expect(entry.companyId).toBeNull();
  });
});
