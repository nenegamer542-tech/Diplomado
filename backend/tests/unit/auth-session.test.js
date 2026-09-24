'use strict';

jest.mock('../../src/modules/auth/session.model', () => ({
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../src/modules/users/user.repository', () => ({
  findById: jest.fn(),
}));
jest.mock('../../src/modules/companies/company.repository', () => ({
  findById: jest.fn(),
}));

const { createHash } = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../../src/modules/auth/session.model');
const userRepository = require('../../src/modules/users/user.repository');
const authService = require('../../src/modules/auth/auth.service');
const { signRefreshToken } = require('../../src/utils/tokens');

const user = {
  _id: '64b000000000000000000001',
  companyId: null,
  branchId: null,
  roleId: '64b000000000000000000002',
  status: 'active',
  tokenVersion: 3,
};

function allowSessionConsumption(result) {
  Session.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(result) });
}

describe('authService.refresh — rotación de sesiones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findById.mockResolvedValue(user);
    Session.create.mockResolvedValue({});
  });

  test('consume una vez el jti hasheado y crea una sesión nueva', async () => {
    const oldJti = 'refresh-session-old';
    const refreshToken = signRefreshToken({ id: user._id, tokenVersion: user.tokenVersion }, oldJti);
    allowSessionConsumption({ _id: 'session-record' });

    const result = await authService.refresh({ refreshToken });

    expect(Session.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user._id,
        tokenVersion: user.tokenVersion,
        refreshIdHash: createHash('sha256').update(oldJti).digest('hex'),
        consumedAt: null,
        expiresAt: expect.objectContaining({ $gt: expect.any(Date) }),
      }),
      { $set: { consumedAt: expect.any(Date) } },
      { new: true }
    );
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    const newJti = jwt.decode(result.refreshToken).jti;
    expect(newJti).toEqual(expect.any(String));
    expect(newJti).not.toBe(oldJti);
    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user._id,
        refreshIdHash: createHash('sha256').update(newJti).digest('hex'),
      })
    );
    expect(JSON.stringify(Session.create.mock.calls[0][0])).not.toContain(newJti);
  });

  test('rechaza un refresh ya consumido sin crear otra sesión', async () => {
    const refreshToken = signRefreshToken({ id: user._id, tokenVersion: user.tokenVersion }, 'replayed');
    allowSessionConsumption(null);

    await expect(authService.refresh({ refreshToken })).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_REVOKED',
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test('rechaza la sesión revocada globalmente antes de consumirla', async () => {
    const refreshToken = signRefreshToken({ id: user._id, tokenVersion: 2 }, 'revoked');

    await expect(authService.refresh({ refreshToken })).rejects.toMatchObject({
      statusCode: 401,
      code: 'TOKEN_REVOKED',
    });
    expect(Session.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
