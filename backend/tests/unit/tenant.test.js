'use strict';

const { tenantFilter, assertOwnership } = require('../../src/middlewares/tenant');

describe('tenantFilter (aislamiento multiempresa)', () => {
  test('usuario de empresa: inyecta companyId del token, nunca del request', () => {
    const req = { user: { companyId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, query: {} };
    expect(tenantFilter(req, { status: 'active' })).toEqual({
      companyId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'active',
    });
  });

  test('sin empresa (usuario normal) → 403', () => {
    const req = { user: { companyId: null }, query: {} };
    let err;
    try {
      tenantFilter(req);
    } catch (e) {
      err = e;
    }
    expect(err.statusCode).toBe(403);
  });

  test('no autenticado → 403', () => {
    const req = { query: {} };
    let err;
    try {
      tenantFilter(req);
    } catch (e) {
      err = e;
    }
    expect(err.statusCode).toBe(403);
  });

  test('Super Admin con ?allCompanies=true → consulta global sin companyId', () => {
    const req = {
      user: { companyId: null, isPlatformAdmin: true },
      query: { allCompanies: 'true' },
    };
    expect(tenantFilter(req, { a: 1 })).toEqual({ a: 1 });
  });

  test('el extra del caller no puede pisar companyId', () => {
    const req = { user: { companyId: 'tokencompany000000000001' }, query: {} };
    const result = tenantFilter(req, { companyId: 'evilcompany000000000001' });
    expect(result.companyId).toBe('tokencompany000000000001');
  });
});

describe('assertOwnership (anti-IDOR entre tenants)', () => {
  const companyA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const companyB = 'bbbbbbbbbbbbbbbbbbbbbbbbbb';

  test('doc null → no lanza (el 404 lo decide el service)', () => {
    expect(() => assertOwnership({ user: { companyId: companyA } }, null)).not.toThrow();
  });

  test('mismo tenant → pasa', () => {
    expect(() =>
      assertOwnership({ user: { companyId: companyA } }, { companyId: companyA })
    ).not.toThrow();
  });

  test('tenant distinto → 404 (no 403: no se revela la existencia)', () => {
    let err;
    try {
      assertOwnership({ user: { companyId: companyA } }, { companyId: companyB });
    } catch (e) {
      err = e;
    }
    expect(err.statusCode).toBe(404);
  });

  test('doc sin companyId (entidad de plataforma) → 404 para usuario de empresa', () => {
    let err;
    try {
      assertOwnership({ user: { companyId: companyA } }, { name: 'x' });
    } catch (e) {
      err = e;
    }
    expect(err.statusCode).toBe(404);
  });

  test('Super Admin sin tenant → pasa con docs de cualquier empresa', () => {
    expect(() =>
      assertOwnership(
        { user: { companyId: null, isPlatformAdmin: true } },
        { companyId: companyB }
      )
    ).not.toThrow();
  });
});
