'use strict';

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createTenant, createUser, login, auth } = require('../helpers/fixtures');

describeIfDb('API /auth (integración)', () => {
  let tenant;
  let admin;

  beforeAll(async () => {
    await connectTestDb();
    tenant = await createTenant({ name: 'Empresa Auth' });
    admin = await createUser({
      company: tenant.company,
      role: tenant.roles.administrador,
      email: 'admin-auth@test.local',
      name: 'Admin',
      password: 'Clave1234',
    });
    await createUser({
      company: tenant.company,
      role: tenant.roles.ventas,
      email: 'lockme@test.local',
      password: 'Clave1234',
      name: 'Lock',
    });
    await createUser({
      company: tenant.company,
      role: tenant.roles.ventas,
      email: 'session@test.local',
      password: 'Clave1234',
      name: 'Session',
    });
    await createUser({
      company: tenant.company,
      role: tenant.roles.ventas,
      email: 'changepw@test.local',
      password: 'Clave1234',
      name: 'Change',
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  test('login válido → tokens y usuario sin hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin-auth@test.local', password: 'Clave1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('admin-auth@test.local');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBe(0);
  });

  test('contraseña incorrecta → 401 con mensaje genérico (anti-enumeración)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin-auth@test.local', password: 'incorrecta1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Correo o contraseña incorrectos.');
  });

  test('email inexistente → EXACTAMENTE el mismo mensaje', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nadie-existe@test.local', password: 'incorrecta1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Correo o contraseña incorrectos.');
  });

  test('body inválido → 422 y campo faltante detallado', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'x@example.com' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
    expect(res.body.error.details.body[0].field).toBe('password');
  });

  test('campo desconocido en body → rechazado (strict)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin-auth@test.local', password: 'Clave1234', role: 'super_admin' });
    expect(res.status).toBe(422);
  });

  test('5 intentos fallidos bloquean la cuenta; ni la clave correcta entra', async () => {
    const email = 'lockme@test.local';

    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'incorrecta1' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    const fifth = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'incorrecta1' });
    expect(fifth.status).toBe(401);
    expect(fifth.body.error.code).toBe('ACCOUNT_LOCKED');

    const withReal = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Clave1234' });
    expect(withReal.status).toBe(401);
    expect(withReal.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  test('/auth/me devuelve usuario, rol y empresa', async () => {
    const token = await login('admin-auth@test.local', 'Clave1234');
    const res = await request(app).get('/api/v1/auth/me').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('admin-auth@test.local');
    expect(res.body.data.role.code).toBe('administrador');
    expect(res.body.data.role.permissions).toContain('users.create');
    expect(res.body.data.company.name).toBe('Empresa Auth');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('/auth/me sin token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('refresh emite nuevos tokens; logout los invalida globalmente', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session@test.local', password: 'Clave1234' });
    const { accessToken, refreshToken } = loginRes.body.data;

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeDefined();

    const logout = await request(app).post('/api/v1/auth/logout').set(auth(accessToken));
    expect(logout.status).toBe(200);
    expect(logout.body.data.loggedOut).toBe(true);

    // El refresh anterior queda invalidado (tokenVersion++).
    const refreshKo = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshKo.status).toBe(401);
    expect(refreshKo.body.error.code).toBe('TOKEN_REVOKED');

    // El access anterior también.
    const meKo = await request(app).get('/api/v1/auth/me').set(auth(accessToken));
    expect(meKo.status).toBe(401);

    // Volver a entrar funciona.
    const again = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session@test.local', password: 'Clave1234' });
    expect(again.status).toBe(200);
  });

  test('refresh token manipulado o de otro tipo → 401', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@test.local', password: 'Clave1234' });
    const { accessToken } = loginRes.body.data;

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: accessToken });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_INVALID');
  });

  test('cambio de contraseña: valida la actual y cierra las sesiones', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@test.local', password: 'Clave1234' });
    const { accessToken } = loginRes.body.data;

    // Contraseña actual incorrecta.
    const wrong = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(accessToken))
      .send({ currentPassword: 'otra-cosa99', newPassword: 'NuevaClave1' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_PASSWORD');

    // Contraseña nueva débil → 422.
    const weak = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(accessToken))
      .send({ currentPassword: 'Clave1234', newPassword: '12345678' });
    expect(weak.status).toBe(422);

    // Correcta.
    const okRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(accessToken))
      .send({ currentPassword: 'Clave1234', newPassword: 'NuevaClave1' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.mustRelogin).toBe(true);

    // La sesión anterior quedó invalidada.
    const meKo = await request(app).get('/api/v1/auth/me').set(auth(accessToken));
    expect(meKo.status).toBe(401);

    // Login con la clave vieja falla; con la nueva, funciona.
    const oldPw = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@test.local', password: 'Clave1234' });
    expect(oldPw.status).toBe(401);

    const newPw = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@test.local', password: 'NuevaClave1' });
    expect(newPw.status).toBe(200);
  });

  test('todo login (éxito y fallo) queda en la auditoría', async () => {
    const token = await login('admin-auth@test.local', 'Clave1234');
    const res = await request(app).get('/api/v1/audit?limit=100').set(auth(token));

    expect(res.status).toBe(200);
    const logins = res.body.data.filter((e) => e.module === 'auth' && e.action === 'LOGIN');
    expect(logins.length).toBeGreaterThan(0);
    expect(logins.some((e) => e.result === 'SUCCESS')).toBe(true);
    expect(logins.some((e) => e.result === 'FAILURE')).toBe(true);
    // Nunca se persisten contraseñas.
    for (const entry of logins) {
      expect(JSON.stringify(entry)).not.toContain('Clave1234');
      expect(JSON.stringify(entry)).not.toContain('incorrecta1');
    }
  });
});
