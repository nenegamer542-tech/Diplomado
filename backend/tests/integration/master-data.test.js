'use strict';

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createTenant, createUser, login, auth } = require('../helpers/fixtures');

describeIfDb('API /master-data (FASE 2)', () => {
  let tenantA;
  let tenantB;
  let adminToken;
  let salesToken;
  let financeToken;
  let tenantBToken;

  beforeAll(async () => {
    await connectTestDb();
    tenantA = await createTenant({ name: 'Maestros Alfa' });
    tenantB = await createTenant({ name: 'Maestros Beta' });
    await createUser({ company: tenantA.company, role: tenantA.roles.administrador, email: 'master-admin@test.local' });
    await createUser({ company: tenantA.company, role: tenantA.roles.ventas, email: 'master-sales@test.local' });
    await createUser({ company: tenantA.company, role: tenantA.roles.finanzas, email: 'master-finance@test.local' });
    await createUser({ company: tenantB.company, role: tenantB.roles.administrador, email: 'master-beta@test.local' });
    adminToken = await login('master-admin@test.local', 'Clave1234');
    salesToken = await login('master-sales@test.local', 'Clave1234');
    financeToken = await login('master-finance@test.local', 'Clave1234');
    tenantBToken = await login('master-beta@test.local', 'Clave1234');
  });

  afterAll(async () => closeTestDb());

  test('crea y lista catálogos tipados; unicidad y tenant vienen del contexto autenticado', async () => {
    const category = await request(app)
      .post('/api/v1/master-data/categories')
      .set(auth(adminToken))
      .send({ code: 'ELEC', name: 'Electrónica' });
    expect(category.status).toBe(201);
    expect(category.body.data.type).toBe('category');
    expect(String(category.body.data.companyId)).toBe(String(tenantA.company._id));

    const duplicate = await request(app)
      .post('/api/v1/master-data/categories')
      .set(auth(adminToken))
      .send({ code: 'elec', name: 'Duplicada' });
    expect(duplicate.status).toBe(409);

    const betaList = await request(app).get('/api/v1/master-data/categories').set(auth(tenantBToken));
    expect(betaList.status).toBe(200);
    expect(betaList.body.data).toHaveLength(0);

    const injection = await request(app)
      .post('/api/v1/master-data/brands')
      .set(auth(adminToken))
      .send({ code: 'ACME', name: 'Acme', companyId: tenantB.company._id });
    expect(injection.status).toBe(422);
  });

  test('crea los tipos con reglas propias y rechaza permisos insuficientes', async () => {
    const unit = await request(app)
      .post('/api/v1/master-data/units')
      .set(auth(adminToken))
      .send({ code: 'KG', name: 'Kilogramo', symbol: 'kg', allowFractions: true });
    expect(unit.status).toBe(201);
    expect(unit.body.data.decimalPlaces).toBe(3);

    const currency = await request(app)
      .post('/api/v1/master-data/currencies')
      .set(auth(adminToken))
      .send({ code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 });
    expect(currency.status).toBe(201);

    const tax = await request(app)
      .post('/api/v1/master-data/taxes')
      .set(auth(adminToken))
      .send({ code: 'VAT16', name: 'IVA 16%', rate: 16 });
    expect(tax.status).toBe(201);

    const invalidTax = await request(app)
      .post('/api/v1/master-data/taxes')
      .set(auth(adminToken))
      .send({ code: 'BAD', name: 'Invalido', rate: 101 });
    expect(invalidTax.status).toBe(422);

    const forbidden = await request(app)
      .post('/api/v1/master-data/brands')
      .set(auth(salesToken))
      .send({ code: 'ACME', name: 'Acme' });
    expect(forbidden.status).toBe(403);
  });

  test('productos guardan referencias tenant-scoped y toman snapshots del maestro', async () => {
    const [category, unit, tax, brand] = await Promise.all([
      request(app).get('/api/v1/master-data/categories').set(auth(adminToken)),
      request(app).get('/api/v1/master-data/units').set(auth(adminToken)),
      request(app).get('/api/v1/master-data/taxes').set(auth(adminToken)),
      request(app)
        .post('/api/v1/master-data/brands')
        .set(auth(adminToken))
        .send({ code: 'ACME', name: 'Acme' }),
    ]);
    expect(brand.status).toBe(201);

    const product = await request(app)
      .post('/api/v1/products')
      .set(auth(adminToken))
      .send({
        sku: 'REF-001',
        name: 'Producto referenciado',
        categoryId: category.body.data[0]._id,
        brandId: brand.body.data._id,
        unitId: unit.body.data[0]._id,
        taxId: tax.body.data[0]._id,
      });
    expect(product.status).toBe(201);
    expect(product.body.data.category).toBe('Electrónica');
    expect(product.body.data.brand).toBe('Acme');
    expect(product.body.data.unit).toBe('kg');
    expect(product.body.data.taxRate).toBe(16);

    const otherTenantReference = await request(app)
      .post('/api/v1/products')
      .set(auth(tenantBToken))
      .send({ sku: 'REF-002', name: 'Cruce tenant', categoryId: category.body.data[0]._id });
    expect(otherTenantReference.status).toBe(404);

    const deleteUsedCategory = await request(app)
      .delete(`/api/v1/master-data/categories/${category.body.data[0]._id}`)
      .set(auth(adminToken));
    expect(deleteUsedCategory.status).toBe(409);
  });

  test('moneda del catálogo se reutiliza en cuentas y no se elimina en uso', async () => {
    const currency = await request(app)
      .post('/api/v1/master-data/currencies')
      .set(auth(adminToken))
      .send({ code: 'CAD', name: 'Dólar canadiense', symbol: 'CA$' });
    expect(currency.status).toBe(201);

    const account = await request(app)
      .post('/api/v1/finance/accounts')
      .set(auth(financeToken))
      .send({ code: 'CAJA-CAD', name: 'Caja CAD', currencyId: currency.body.data._id });
    expect(account.status).toBe(201);
    expect(account.body.data.currency).toBe('CAD');

    const deletion = await request(app)
      .delete(`/api/v1/master-data/currencies/${currency.body.data._id}`)
      .set(auth(adminToken));
    expect(deletion.status).toBe(409);
  });
});
