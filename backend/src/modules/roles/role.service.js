'use strict';

const ApiError = require('../../utils/ApiError');
const { isValidPermission } = require('../../config/permissions');
const {
  assertCanGrantPermissions,
} = require('../../common/privilege');
const roleRepository = require('./role.repository');
const userRepository = require('../users/user.repository');

/** Valida cada permiso contra el catálogo EN CÓDIGO (ADR-002). */
function assertPermissionsInCatalog(permissions = []) {
  const invalid = permissions.filter((p) => !isValidPermission(p));
  if (invalid.length) {
    throw ApiError.unprocessable('Los datos enviados no son válidos.', invalid.map((p) => ({
      field: 'permissions',
      message: `Permiso desconocido: ${p}.`,
    })));
  }
}

/** Ownership: el rol debe pertenecer al tenant del actor (o ser plataforma). */
function assertRoleOwnership(role, actor) {
  const actorCompany = actor?.companyId ? String(actor.companyId) : null;
  const roleCompany = role.companyId ? String(role.companyId) : null;

  if (actor?.isPlatformAdmin && !actorCompany) return; // Super Admin: fuera de tenant
  if (roleCompany !== actorCompany) throw ApiError.notFound('Recurso no encontrado.');
}

const roleService = {
  async list(filter, options) {
    return roleRepository.find(filter, options);
  },

  async getById(id) {
    return roleRepository.findById(id);
  },

  async create(data, actor) {
    const companyId = actor?.companyId || null;
    if (!companyId) {
      throw ApiError.forbidden('Debe crear roles dentro de una empresa.');
    }

    assertPermissionsInCatalog(data.permissions || []);
    assertCanGrantPermissions(actor, data.permissions || []); // anti-escalada

    const existing = await roleRepository.findByCode(companyId, data.code);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
    }

    return roleRepository.create({
      companyId,
      code: data.code,
      label: data.label,
      description: data.description,
      permissions: data.permissions || [],
      isSystem: false, // jamás marcado por cliente
      status: data.status || 'active',
    });
  },

  async update(id, data, actor) {
    const role = await roleRepository.findById(id);
    if (!role) throw ApiError.notFound('Recurso no encontrado.');
    assertRoleOwnership(role, actor);

    if (role.isSystem) {
      throw ApiError.conflict('Los roles del sistema no pueden modificarse.');
    }

    if (data.permissions) {
      assertPermissionsInCatalog(data.permissions);
      assertCanGrantPermissions(actor, data.permissions); // anti-escalada
    }

    if (data.code && data.code !== role.code) {
      const dup = await roleRepository.findByCode(role.companyId, data.code);
      if (dup) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
      }
    }

    return roleRepository.updateById(id, data);
  },

  async remove(id, actor) {
    const role = await roleRepository.findById(id);
    if (!role) throw ApiError.notFound('Recurso no encontrado.');
    assertRoleOwnership(role, actor);

    if (role.isSystem) {
      throw ApiError.conflict('Los roles del sistema no pueden eliminarse.');
    }

    const inUse = await userRepository.countByRole(id);
    if (inUse > 0) {
      throw ApiError.conflict(`El rol está en uso por ${inUse} usuario(s).`);
    }

    return roleRepository.deleteById(id);
  },
};

module.exports = roleService;
