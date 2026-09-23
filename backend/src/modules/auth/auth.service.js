'use strict';

const ApiError = require('../../utils/ApiError');
const { hashPassword, verifyPassword } = require('../../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/tokens');
const userRepository = require('../users/user.repository');
const roleRepository = require('../roles/role.repository');
const companyRepository = require('../companies/company.repository');
const branchRepository = require('../branches/branch.repository');
const auditService = require('../audit/audit.service');

const MAX_FAILED_ATTEMPTS = 5;
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.';

/**
 * Servicio de autenticación.
 *
 * Reglas de seguridad:
 *  - Mensaje ÚNICO para "usuario no existe" y "contraseña incorrecta"
 *    (anti-enumeración); el orden es: password → estado → empresa.
 *  - 5 intentos fallidos => cuenta bloqueada (status 'locked').
 *  - tokenVersion++ en logout/cambio de contraseña = cierre global de sesión.
 *  - Login/refresh verifican que la EMPRESA esté activa (no sólo el usuario).
 *  - Todo login (éxito o fallo) queda en la auditoría.
 */

/** Hash temporal para igualar tiempos cuando el email no existe. */
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(`timing-equalizer-${Date.now()}`);
  return dummyHashPromise;
}

function toTokenUser(user) {
  return {
    id: String(user._id),
    companyId: user.companyId ? String(user.companyId) : null,
    branchId: user.branchId ? String(user.branchId) : null,
    roleId: String(user.roleId),
    tokenVersion: user.tokenVersion ?? 0,
  };
}

function stripSecrets(user) {
  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.resetPasswordTokenHash;
  delete safe.resetPasswordExpiresAt;
  return safe;
}

const authService = {
  async login({ email, password }, meta = {}) {
    const user = await userRepository.findByEmail(email);

    const failLogin = async (message, target, code) => {
      await auditService.log({
        module: 'auth',
        action: 'LOGIN',
        resourceType: 'user',
        resourceId: target ? String(target._id) : null,
        companyId: target?.companyId || null,
        userId: target ? String(target._id) : null,
        userEmail: email,
        result: 'FAILURE',
        message,
        ...meta,
      });
      throw ApiError.unauthorized(message, code);
    };

    if (!user) {
      // Iguala el tiempo de respuesta con un login inexistente.
      await verifyPassword(password, await getDummyHash());
      return failLogin(INVALID_CREDENTIALS, null, 'INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const locked = attempts >= MAX_FAILED_ATTEMPTS;
      await userRepository.updateById(user._id, {
        failedLoginAttempts: attempts,
        ...(locked ? { status: 'locked' } : {}),
      });
      if (locked) {
        return failLogin(
          'La cuenta fue bloqueada por seguridad tras varios intentos.',
          user,
          'ACCOUNT_LOCKED'
        );
      }
      return failLogin(INVALID_CREDENTIALS, user, 'INVALID_CREDENTIALS');
    }

    // Contraseña correcta: ahora sí se informa el estado real.
    if (user.status === 'locked') {
      return failLogin(
        'La cuenta está bloqueada por seguridad. Contacte al administrador.',
        user,
        'ACCOUNT_LOCKED'
      );
    }
    if (user.status !== 'active') {
      return failLogin('La cuenta está inactiva.', user, 'ACCOUNT_INACTIVE');
    }

    if (user.companyId) {
      const company = await companyRepository.findById(user.companyId);
      if (!company) {
        return failLogin('La cuenta no pertenece a una empresa válida.', user, 'COMPANY_INVALID');
      }
      if (company.status !== 'active') {
        return failLogin(
          'La empresa está suspendida. Contacte al administrador de plataforma.',
          user,
          'COMPANY_SUSPENDED'
        );
      }
    }

    await userRepository.resetLoginFailures(user._id);

    const tokenUser = toTokenUser(user);
    const result = {
      user: stripSecrets({ ...user, failedLoginAttempts: 0, lastLoginAt: new Date() }),
      accessToken: signAccessToken(tokenUser),
      refreshToken: signRefreshToken(tokenUser),
    };

    await auditService.log({
      module: 'auth',
      action: 'LOGIN',
      resourceType: 'user',
      resourceId: String(user._id),
      companyId: user.companyId || null,
      userId: String(user._id),
      userEmail: user.email,
      result: 'SUCCESS',
      ...meta,
    });

    return result;
  },

  async refresh({ refreshToken }) {
    const payload = verifyRefreshToken(refreshToken);

    const user = await userRepository.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Refresh token inválido o expirado.', 'REFRESH_INVALID');
    if (user.status !== 'active') {
      throw ApiError.unauthorized('La cuenta no está activa.', 'ACCOUNT_INACTIVE');
    }
    // tokenVersion distinto => logout global: el refresh ya fue invalidado.
    if ((user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
      throw ApiError.unauthorized('La sesión fue cerrada. Inicie sesión nuevamente.', 'TOKEN_REVOKED');
    }
    if (user.companyId) {
      const company = await companyRepository.findById(user.companyId);
      if (!company || company.status !== 'active') {
        throw ApiError.forbidden(
          'La empresa está suspendida. Contacte al administrador de plataforma.'
        );
      }
    }

    const tokenUser = toTokenUser(user);
    return {
      accessToken: signAccessToken(tokenUser),
      refreshToken: signRefreshToken(tokenUser),
    };
  },

  /** Logout GLOBAL: incrementa tokenVersion y anula todos los refresh emitidos. */
  async logout(actor, meta = {}) {
    await userRepository.bumpTokenVersion(actor.id);
    await auditService.log({
      module: 'auth',
      action: 'LOGOUT',
      resourceType: 'session',
      resourceId: actor.id,
      companyId: actor.companyId || null,
      userId: actor.id,
      userEmail: actor.email,
      result: 'SUCCESS',
      ...meta,
    });
    return { loggedOut: true };
  },

  /** Contexto completo para el frontend tras /auth/me. */
  async me(actor) {
    const user = await userRepository.findById(actor.id);
    if (!user) throw ApiError.unauthorized('Usuario no encontrado.');

    const [role, company, branch] = await Promise.all([
      actor.roleId ? roleRepository.findById(actor.roleId) : Promise.resolve(null),
      actor.companyId
        ? companyRepository.findById(actor.companyId)
        : Promise.resolve(null),
      actor.branchId
        ? branchRepository.findById(actor.branchId, { companyId: actor.companyId })
        : Promise.resolve(null),
    ]);

    return {
      user: stripSecrets(user),
      role: role
        ? { _id: role._id, code: role.code, label: role.label, permissions: role.permissions }
        : null,
      company: company
        ? {
            _id: company._id,
            name: company.name,
            currency: company.currency,
            timezone: company.timezone,
            status: company.status,
          }
        : null,
      branch: branch ? { _id: branch._id, code: branch.code, name: branch.name } : null,
    };
  },

  async changePassword(actor, { currentPassword, newPassword }, meta = {}) {
    const user = await userRepository.findByEmail(actor.email);
    if (!user) throw ApiError.unauthorized('Usuario no encontrado.');

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      await auditService.log({
        module: 'auth',
        action: 'CHANGE_PASSWORD',
        resourceType: 'user',
        resourceId: actor.id,
        companyId: actor.companyId || null,
        userId: actor.id,
        userEmail: actor.email,
        result: 'FAILURE',
        message: 'Contraseña actual incorrecta.',
        ...meta,
      });
      throw ApiError.unauthorized('La contraseña actual es incorrecta.', 'INVALID_PASSWORD');
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updateById(user._id, {
      passwordHash,
      tokenVersion: (user.tokenVersion || 0) + 1, // cierra las demás sesiones
    });

    await auditService.log({
      module: 'auth',
      action: 'CHANGE_PASSWORD',
      resourceType: 'user',
      resourceId: actor.id,
      companyId: actor.companyId || null,
      userId: actor.id,
      userEmail: actor.email,
      result: 'SUCCESS',
      ...meta,
    });

    return { changed: true, mustRelogin: true };
  },
};

module.exports = authService;
