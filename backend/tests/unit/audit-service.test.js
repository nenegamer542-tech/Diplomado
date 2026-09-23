'use strict';

// Se sustituye el repositorio real: estas pruebas sólo verifican el
// comportamiento del service (redacción + no bloqueo, ADR-005).
jest.mock('../../src/modules/audit/audit.repository', () => ({
  create: jest.fn().mockResolvedValue({}),
  list: jest.fn(),
  findById: jest.fn(),
}));

const auditRepository = require('../../src/modules/audit/audit.repository');
const auditService = require('../../src/modules/audit/audit.service');

beforeEach(() => {
  auditRepository.create.mockClear();
  auditRepository.create.mockResolvedValue({});
});

describe('auditService.log — redacción', () => {
  test('redacta contraseñas y tokens antes de persistir', async () => {
    await auditService.log({
      module: 'users',
      action: 'CREATE_USER',
      companyId: 'c1',
      userId: 'u1',
      after: { email: 'a@b.c', password: 'SuperSecret1!', refreshToken: 'eyJhbGci' },
    });

    const entry = auditRepository.create.mock.calls[0][0];
    expect(entry.after.password).toBe('[REDACTED]');
    expect(entry.after.refreshToken).toBe('[REDACTED]');
    expect(entry.after.email).toBe('a@b.c'); // lo no sensible se conserva
  });

  test('redacción recursiva en estructuras anidadas', async () => {
    await auditService.log({
      module: 'auth',
      action: 'X',
      after: { inner: { apiSecret: 'shhh', keep: 'ok' } },
    });
    const entry = auditRepository.create.mock.calls[0][0];
    expect(entry.after.inner.apiSecret).toBe('[REDACTED]');
    expect(entry.after.inner.keep).toBe('ok');
  });

  test('aplica defaults: result SUCCESS y before null', async () => {
    await auditService.log({ module: 'branches', action: 'CREATE_BRANCH' });
    const entry = auditRepository.create.mock.calls[0][0];
    expect(entry.result).toBe('SUCCESS');
    expect(entry.before).toBeNull();
    expect(entry.companyId).toBeNull();
  });
});

describe('auditService.log — nunca bloquea (ADR-005)', () => {
  test('un fallo del repositorio NO se propaga al llamador', async () => {
    auditRepository.create.mockRejectedValueOnce(new Error('mongo caído'));

    await expect(
      auditService.log({ module: 'users', action: 'UPDATE_USER' })
    ).resolves.toBeUndefined();
  });

  test('logOrFail SÍ propaga (para operaciones críticas futuras)', async () => {
    auditRepository.create.mockRejectedValueOnce(new Error('mongo caído'));
    await expect(auditService.logOrFail({ module: 'x', action: 'y' })).rejects.toThrow(
      'mongo caído'
    );
  });
});
