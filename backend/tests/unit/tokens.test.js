'use strict';

const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const {
  signAccessToken,
  signAccessToken: signAccess,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../../src/utils/tokens');

const user = {
  id: '64b000000000000000000001',
  companyId: '64b000000000000000000002',
  branchId: null,
  roleId: '64b000000000000000000003',
  tokenVersion: 4,
};

describe('Access token', () => {
  test('payload con sub, companyId, roleId y tv', () => {
    const payload = verifyAccessToken(signAccess(user));
    expect(payload.sub).toBe(user.id);
    expect(payload.companyId).toBe(user.companyId);
    expect(payload.roleId).toBe(user.roleId);
    expect(payload.tv).toBe(4);
    expect(payload.iss).toBe('erp-backend');
  });

  test('firma con el secreto de ACCESO: un refresh no lo valida', () => {
    const refreshToken = signRefreshToken(user);
    let err;
    try {
      verifyAccessToken(refreshToken);
    } catch (e) {
      err = e;
    }
    expect(err.code).toBe('TOKEN_INVALID');
  });
});

describe('Refresh token', () => {
  test('payload MINIMALISTA: sólo sub y tv (nada de empresa/rol)', () => {
    const payload = verifyRefreshToken(signRefreshToken(user));
    expect(payload.sub).toBe(user.id);
    expect(payload.tv).toBe(4);
    expect(payload.companyId).toBeUndefined();
    expect(payload.roleId).toBeUndefined();
  });

  test('un access token no pasa como refresh', () => {
    let err;
    try {
      verifyRefreshToken(signAccessToken(user));
    } catch (e) {
      err = e;
    }
    expect(err.code).toBe('REFRESH_INVALID');
  });
});

describe('Tokens manipulados', () => {
  test('token firmado con otro secreto → TOKEN_INVALID', () => {
    const forged = jwt.sign({ sub: user.id, tv: 0 }, 'secreto-de-otro-servidor', {
      issuer: 'erp-backend',
    });
    let err;
    try {
      verifyAccessToken(forged);
    } catch (e) {
      err = e;
    }
    expect(err.code).toBe('TOKEN_INVALID');
  });

  test('payload alterado (tv manipulado) → inválido', () => {
    const token = signAccessToken(user);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: user.id, companyId: user.companyId, tv: 999, iss: 'erp-backend' })
    ).toString('base64url');
    const forged = `${header}.${forgedPayload}.${signature}`;

    let err;
    try {
      verifyAccessToken(forged);
    } catch (e) {
      err = e;
    }
    expect(err.code).toBe('TOKEN_INVALID');
  });

  test('token expirado → TOKEN_EXPIRED (mensaje amigable)', () => {
    const expired = jwt.sign({ sub: user.id, tv: 0 }, env.jwt.accessSecret, {
      expiresIn: '-1s',
      issuer: 'erp-backend',
    });
    let err;
    try {
      verifyAccessToken(expired);
    } catch (e) {
      err = e;
    }
    expect(err.code).toBe('TOKEN_EXPIRED');
    expect(err.statusCode).toBe(401);
  });
});

// Guard de sanidad: signAccessToken importado dos veces es el mismo módulo.
test('exports consistentes', () => {
  expect(signAccessToken).toBe(signAccess);
});
