'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Guardias anti-escalada de privilegios (FASE 2).
 *
 * Regla central: NADIE otorga (rol, permisos o usuario) algo que no posee,
 * salvo el Super Admin de plataforma. Evita que un administrador de empresa
 * cree un rol "super" o asigne permisos que él mismo no tiene.
 */

function actorHas(actor, permission) {
  const own = actor?.permissions || [];
  return own.includes('*') || own.includes(permission);
}

/** El actor debe poseer TODOS los permisos que intenta otorgar. */
function assertCanGrantPermissions(actor, permissions = []) {
  if (actor?.isPlatformAdmin) return;
  const missing = permissions.filter((p) => !actorHas(actor, p));
  if (missing.length) {
    throw ApiError.forbidden(
      `No puede otorgar permisos que usted no posee: ${missing.join(', ')}.`
    );
  }
}

/**
 * El rol destino debe pertenecer al mismo tenant que el actor
 * (o el actor ser Super Admin sin tenant).
 */
function assertRoleInTenant(actor, role) {
  if (!role) {
    throw ApiError.unprocessable('El rol indicado no existe.', [
      { field: 'roleId', message: 'Rol inexistente o no disponible.' },
    ]);
  }
  const actorCompany = actor?.companyId ? String(actor.companyId) : null;
  if (actor?.isPlatformAdmin && !actorCompany) return; // plataforma: fuera de tenant

  const roleCompany = role.companyId ? String(role.companyId) : null;
  if (!roleCompany || roleCompany !== actorCompany) {
    throw ApiError.unprocessable('El rol indicado no existe.', [
      { field: 'roleId', message: 'Rol inexistente o no disponible.' },
    ]);
  }
}

/** El rol debe estar activo para poder asignarse/usarse. */
function assertRoleUsable(role) {
  if (role.status !== 'active') {
    throw ApiError.conflict('El rol indicado está inactivo.');
  }
}

module.exports = { assertCanGrantPermissions, assertRoleInTenant, assertRoleUsable, actorHas };
