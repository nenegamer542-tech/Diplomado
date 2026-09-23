'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('./ApiError');

/**
 * Emisión y verificación de tokens.
 *
 * Access token:  corto (15m), lleva { sub, companyId, roleId, tv }.
 * Refresh token:  largo (7d), lleva { sub, tv } a propósito MINIMALISTA
 *                 (menos datos expuestos si se filtra).
 *
 * `tv` = tokenVersion del usuario: cambiarlo en logout invalida todos los
 * refresh tokens emitidos previamente (logout global) sin lista negra en BD.
 */

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      companyId: user.companyId ? String(user.companyId) : null,
      branchId: user.branchId ? String(user.branchId) : null,
      roleId: user.roleId ? String(user.roleId) : null,
      tv: user.tokenVersion ?? 0,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires, issuer: 'erp-backend' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, tv: user.tokenVersion ?? 0 },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpires, issuer: 'erp-backend' }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwt.accessSecret, { issuer: 'erp-backend' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('La sesión ha expirado. Renueve el token.', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Token inválido.', 'TOKEN_INVALID');
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwt.refreshSecret, { issuer: 'erp-backend' });
  } catch {
    throw ApiError.unauthorized('Refresh token inválido o expirado.', 'REFRESH_INVALID');
  }
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
