'use strict';

const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');
const userRepository = require('../modules/users/user.repository');
const roleRepository = require('../modules/roles/role.repository');
const logger = require('../config/logger');

/**
 * Autenticación: valida el access token y monta req.user con el contexto
 * completo necesario para autorización y multiempresa:
 *
 * req.user = { id, email, name, companyId, branchId, roleId, permissions[], isPlatformAdmin, tokenVersion }
 *
 * Si el usuario está bloqueado o su tokenVersion no coincide con el token,
 * se rechaza (logout global efectivo).
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Falta el token de autenticación.');
    }

    const payload = verifyAccessToken(token);

    const user = await userRepository.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Usuario no encontrado.');
    if (user.status !== 'active') throw ApiError.unauthorized('La cuenta está inactiva.');

    // Logout global: el token fue emitido con otra versión.
    if ((user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
      throw ApiError.unauthorized('La sesión fue cerrada. Inicie sesión nuevamente.', 'TOKEN_REVOKED');
    }

    // Carga de permisos desde el rol (fuente de verdad = BD, catálogo = código).
    let permissions = [];
    let roleName = null;
    if (user.roleId) {
      const role = await roleRepository.findById(user.roleId);
      if (
        role &&
        role.status === 'active' &&
        (role.companyId === null || String(role.companyId) === String(user.companyId))
      ) {
        permissions = role.permissions || [];
        roleName = role.code;
      }
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      companyId: user.companyId ? String(user.companyId) : null,
      branchId: user.branchId ? String(user.branchId) : null,
      roleId: user.roleId ? String(user.roleId) : null,
      roleName,
      permissions,
      // Super Admin de plataforma: existe fuera de un tenant concreto.
      isPlatformAdmin: roleName === 'super_admin' || user.isPlatformAdmin === true,
      tokenVersion: user.tokenVersion ?? 0,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/** Alias explícito para rutas públicas que necesitan optar por auth. */
module.exports = authenticate;
module.exports.authenticate = authenticate;
