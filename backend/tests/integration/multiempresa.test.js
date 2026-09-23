'use strict';

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createTenant, createUser, login, auth } = require('../helpers/fixtures');

describeIfDb('Multiempresa + permisos (integración)', () => {
  let A;
  let B;
  let adminA;
  let adminB;
  let ventasA;
  let tokenA;
  let tokenB;
  let tokenVentasA;

  beforeAll(async () => {
    await connectTestDb();
    A = await createTenant({ name: 'Empresa Alfa' });
    B = await createTenant({ name: 'Empresa Beta' });

    adminA = await createUser({
      company: A.company,
      role: A.roles.administrador,
      email: 'admin@alfa.local',
      password: 'Clave1234',
      name: 'Admin',
      lastName: 'Alfa',
    });
    adminB = await createUser({
      company: B.company,
      role: B.roles.administrador,
      email: 'admin@beta.local',
      password: 'Clave1234',
      name: 'Admin',
      lastName: 'Beta',
    });
    ventasA = await createUser({
      company: A.company,
      role: A.roles.ventas,
      email: 'ventas@alfa.local',
      password: 'Clave1234',
      name: 'Ventas',
      lastName: 'Alfa',
    });

    tokenA = await login('admin@alfa.local', 'Clave1234');
    tokenB = await login('admin@beta.local', 'Clave1234');
    tokenVentasA = await login('ventas@alfa.local', 'Clave1234');
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // ---------------------------------------------------------- aislamiento

  test('listado de usuarios: cada empresa sólo ve las suyas', async () => {
    const res = await request(app).get('/api/v1/users?limit=100').set(auth(tokenA));

    expect(res.status).toBe(200);
    const emails = res.body.data.map((u) => u.email);
    expect(emails).toContain('admin@alfa.local');
    expect(emails).toContain('ventas@alfa.local');
    expect(emails).not.toContain('admin@beta.local');
    for (const u of res.body.data) {
      expect(u.companyId).toBe(String(A.company._id));
    }
    // Nunca se devuelve el hash.
    expect(res.body.data[0].passwordHash).toBeUndefined();
  });

  test('manipular el ID de la empresa B en la URL no sirve (404, no 403)', async () => {
    const getRes = await request(app)
      .get(`/api/v1/users/${adminB._id}`)
      .set(auth(tokenA));
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/v1/users/${adminB._id}`)
      .set(auth(tokenA))
      .send({ name: 'Hackeado' });
    expect(patchRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`/api/v1/users/${adminB._id}`)
      .set(auth(tokenA));
    expect(delRes.status).toBe(404);
  });

  test('roles y sucursales de otra empresa → 404', async () => {
    const roleRes = await request(app)
      .get(`/api/v1/roles/${B.roles.administrador._id}`)
      .set(auth(tokenA));
    expect(roleRes.status).toBe(404);

    const branchRes = await request(app)
      .get(`/api/v1/branches/${B.branch._id}`)
      .set(auth(tokenA));
    expect(branchRes.status).toBe(404);
  });

  test('el código de sucursal es único POR empresa, no globalmente', async () => {
    const a1 = await request(app)
      .post('/api/v1/branches')
      .set(auth(tokenA))
      .send({ code: 'SUC01', name: 'Sucursal A1' });
    expect(a1.status).toBe(201);

    // La misma empresa repite el código → 409.
    const a2 = await request(app)
      .post('/api/v1/branches')
      .set(auth(tokenA))
      .send({ code: 'SUC01', name: 'Repetida' });
    expect(a2.status).toBe(409);
    expect(a2.body.error.message).toContain('Ya existe un registro con ese valor en');

    // Otra empresa usa el MISMO código sin problema.
    const b1 = await request(app)
      .post('/api/v1/branches')
      .set(auth(tokenB))
      .send({ code: 'SUC01', name: 'Sucursal B1' });
    expect(b1.status).toBe(201);
  });

  test('listado de sucursales: sólo las del tenant', async () => {
    const res = await request(app).get('/api/v1/branches?limit=100').set(auth(tokenA));
    expect(res.status).toBe(200);
    for (const b of res.body.data) {
      expect(b.companyId).toBe(String(A.company._id));
    }
    expect(res.body.data.map((b) => b._id)).not.toContain(String(B.branch._id));
  });

  test('la auditoría de A no contiene acciones de B', async () => {
    const res = await request(app).get('/api/v1/audit?limit=100').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0); // logins + creaciones de A
    for (const entry of res.body.data) {
      expect(entry.companyId).toBe(String(A.company._id));
    }
  });

  // ----------------------------------------------------------- permisos

  test('rol sin permiso → 403 con el mensaje canónico', async () => {
    const res = await request(app).get('/api/v1/users').set(auth(tokenVentasA));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('No tiene permisos para esta operación.');
    expect(res.body.error.message).toContain('users.read');
  });

  test('rol ventas sin acceso a sucursales, roles ni auditoría', async () => {
    const branches = await request(app).get('/api/v1/branches').set(auth(tokenVentasA));
    expect(branches.status).toBe(403);

    const roles = await request(app).get('/api/v1/roles').set(auth(tokenVentasA));
    expect(roles.status).toBe(403);

    const audit = await request(app).get('/api/v1/audit').set(auth(tokenVentasA));
    expect(audit.status).toBe(403);
  });

  test('sin token → 401 en cualquier módulo', async () => {
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
    expect((await request(app).get('/api/v1/branches')).status).toBe(401);
    expect((await request(app).get('/api/v1/roles')).status).toBe(401);
    expect((await request(app).get('/api/v1/audit')).status).toBe(401);
  });

  // ------------------------------------------------- anti-escalada / reglas

  test('nadie otorga permisos que no posee (companies.create)', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set(auth(tokenA))
      .send({
        code: 'megarol',
        label: 'Mega Rol',
        permissions: ['companies.create', 'users.read'],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('companies.create');
  });

  test('permiso inventado (fuera del catálogo) → 422', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set(auth(tokenA))
      .send({ code: 'inventado', label: 'Inventado', permissions: ['hacker.everything'] });
    expect(res.status).toBe(422);
  });

  test('no se asigna un rol de OTRA empresa → 422', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(auth(tokenA))
      .send({
        name: 'Muy',
        lastName: 'Listo',
        email: 'listo@alfa.local',
        password: 'Clave1234',
        roleId: String(B.roles.ventas._id),
      });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('roleId');
  });

  test('rol del sistema no se modifica ni se elimina', async () => {
    const patch = await request(app)
      .patch(`/api/v1/roles/${A.roles.administrador._id}`)
      .set(auth(tokenA))
      .send({ label: 'Hackeado' });
    expect(patch.status).toBe(409);

    const del = await request(app)
      .delete(`/api/v1/roles/${A.roles.administrador._id}`)
      .set(auth(tokenA));
    expect(del.status).toBe(409);
  });

  test('rol en uso por usuarios no se elimina', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles/${A.roles.ventas._id}`)
      .set(auth(tokenA));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('usuario');
  });

  test('el usuario no se elimina a sí mismo', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${adminA._id}`)
      .set(auth(tokenA));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('propia cuenta');
  });

  test('gestión de empresas: prohibida para no-plataforma', async () => {
    const list = await request(app).get('/api/v1/companies').set(auth(tokenA));
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/companies')
      .set(auth(tokenA))
      .send({ name: 'Nueva Empresa' });
    expect(create.status).toBe(403);

    const del = await request(app)
      .delete(`/api/v1/companies/${B.company._id}`)
      .set(auth(tokenA));
    expect(del.status).toBe(403);
  });

  test('administrador de empresa: edita lo suyo pero NO suspende', async () => {
    const getOther = await request(app)
      .get(`/api/v1/companies/${B.company._id}`)
      .set(auth(tokenA));
    expect(getOther.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/v1/companies/${A.company._id}`)
      .set(auth(tokenA))
      .send({ name: 'Empresa Alfa Renombrada', status: 'suspended' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.name).toBe('Empresa Alfa Renombrada');
    expect(patch.body.data.status).toBe('active'); // el estado NO se aplica
  });

  // Última prueba del archivo: toca la contraseña de ventasA.
  test('cambio de contraseña por admin: la nueva clave abre sesión', async () => {
    const patch = await request(app)
      .patch(`/api/v1/users/${ventasA._id}`)
      .set(auth(tokenA))
      .send({ password: 'NuevaClave9' });
    expect(patch.status).toBe(200);

    expect((await login('ventas@alfa.local', 'NuevaClave9'))).toBeDefined();

    let err;
    try {
      await login('ventas@alfa.local', 'Clave1234');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined(); // la clave vieja ya no sirve
  });
});
