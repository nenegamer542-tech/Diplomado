'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Autorización basada en permisos (RBAC) — no solo en rol.
 *
 * Uso: router.get('/', authenticate, authorize('products.read'), ctrl.list)
 *
 * Reglas:
 *  - Super Admin de plataforma pasa siempre (salvo authorize.strict).
 *  - Los permisos vienen del rol cargado en authenticate (no del cliente).
 *  - Un cliente NUNCA puede enviar permisos propios: se ignoran.
 */
function authorize(...required) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());

    const has = required.every((perm) => {
      // '*' es permiso comodín de Super Admin.
      if (req.user.permissions.includes('*')) return true;
      return req.user.permissions.includes(perm);
    });

    if (!has) {
      return next(
        ApiError.forbidden(
          `No tiene permisos para esta operación. Se requiere: ${required.join(', ')}.`
        )
      );
    }
    return next();
  };
}

/** Requiere que el usuario pertenezca a un tenant (companyId presente). */
function requireTenant(req, res, next) {
  if (!req.user?.companyId) {
    return next(ApiError.forbidden('Esta operación requiere pertenecer a una empresa.'));
  }
  return next();
}

/** Solo Super Admin de plataforma. */
function platformOnly(req, res, next) {
  if (!req.user?.isPlatformAdmin) {
    return next(ApiError.forbidden('Operación reservada al administrador de plataforma.'));
  }
  return next();
}

module.exports = { authorize, requireTenant, platformOnly };
