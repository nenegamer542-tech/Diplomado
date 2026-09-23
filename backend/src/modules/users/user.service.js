'use strict';

const ApiError = require('../../utils/ApiError');
const { hashPassword, isStrongPassword } = require('../../utils/password');
const {
  assertCanGrantPermissions,
  assertRoleUsable,
} = require('../../common/privilege');
const userRepository = require('./user.repository');
const roleRepository = require('../roles/role.repository');
const branchRepository = require('../branches/branch.repository');

/**
 * Servicio de usuarios (multiempresa estricto).
 *
 * Reglas de seguridad:
 *  - El scope de empresa SALE DEL TOKEN (actor), nunca del request.
 *  - Nadie otorga un rol con permisos que no posee (anti-escalada).
 *  - Nadie se edita a sí mismo en rol/estado (evita auto-bloqueo/descenso).
 *  - No se desactiva al último administrador activo de la empresa.
 *  - Cambio de rol/estado/contraseña => tokenVersion++ (cierra sesiones abiertas).
 *  - DELETE = borrado LÓGICO (status inactive) para conservar auditoría.
 */

function scopeOptions(user) {
  return user.companyId ? { companyId: user.companyId } : {};
}

function sameId(a, b) {
  return String(a) === String(b);
}

const userService = {
  async list(filter, options, actor) {
    // Sin companyId sólo el Super Admin (vía ?allCompanies=true) puede listar.
    if (!filter.companyId && !actor?.isPlatformAdmin) {
      throw ApiError.forbidden('Operación no disponible fuera del contexto de una empresa.');
    }
    return userRepository.find(filter, options);
  },

  /** Alcance: miembro sólo ve su empresa; Super Admin, cualquiera. */
  async getById(id, actor) {
    if (actor?.companyId) return userRepository.findById(id, { companyId: actor.companyId });
    if (actor?.isPlatformAdmin) return userRepository.findById(id);
    throw ApiError.forbidden('Operación no disponible fuera del contexto de una empresa.');
  },

  /** Resuelve y valida la empresa destino del usuario a crear/modificar. */
  _resolveTargetCompanyId(data, actor) {
    if (actor.isPlatformAdmin && data.companyId) return String(data.companyId);
    if (actor.companyId) {
      if (data.companyId && !sameId(data.companyId, actor.companyId)) {
        throw ApiError.forbidden('No puede crear usuarios en otra empresa.');
      }
      return String(actor.companyId);
    }
    throw ApiError.badRequest('Debe indicar companyId para gestionar usuarios.');
  },

  /** El rol debe pertenecer a la empresa destino y ser utilizable. */
  async _assertRoleForCompany(roleId, companyId, actor) {
    const role = await roleRepository.findById(roleId);
    // Normaliza a string: companyId puede llegar como ObjectId (docs lean)
    // y la comparación estricta ObjectId !== string siempre fallaría.
    const targetCompany = companyId ? String(companyId) : null;
    const roleCompany = role?.companyId ? String(role.companyId) : null;
    if (!role || roleCompany !== targetCompany) {
      throw ApiError.unprocessable('Los datos enviados no son válidos.', [
        { field: 'roleId', message: 'El rol indicado no existe en la empresa destino.' },
      ]);
    }
    assertRoleUsable(role);
    assertCanGrantPermissions(actor, role.permissions || []); // anti-escalada
    return role;
  },

  async create(data, actor) {
    const companyId = this._resolveTargetCompanyId(data, actor);
    delete data.companyId;

    await this._assertRoleForCompany(data.roleId, companyId, actor);

    // Email único global (login). Chequeo previo para mensaje claro;
    // el índice unique de Mongo es el respaldo final (11000).
    const existing = await userRepository.findOne({ email: data.email });
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: email.', {
        fields: ['email'],
      });
    }

    // Sucursal: la indicada (validada contra la empresa) o la predeterminada.
    let branchId = null;
    if (data.branchId) {
      const branch = await branchRepository.findById(data.branchId, { companyId });
      if (!branch) {
        throw ApiError.unprocessable('Los datos enviados no son válidos.', [
          { field: 'branchId', message: 'La sucursal indicada no existe en la empresa.' },
        ]);
      }
      branchId = branch._id;
    } else {
      const def = await branchRepository.findDefault(companyId);
      branchId = def ? def._id : null;
    }

    const passwordHash = await hashPassword(data.password);

    const created = await userRepository.create({
      companyId,
      branchId,
      roleId: data.roleId,
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      status: data.status || 'active',
      isPlatformAdmin: false, // jamás marcable vía API (sólo semilla/plataforma)
    });

    // Model.create devuelve el documento COMPLETO: el hash NUNCA sale por la API
    // (select:false sólo protege a las consultas, no a los documentos creados).
    const safe = { ...created };
    delete safe.passwordHash;
    delete safe.resetPasswordTokenHash;
    delete safe.resetPasswordExpiresAt;
    return safe;
  },

  async update(id, data, actor) {
    const user = await this.getById(id, actor);
    if (!user) throw ApiError.notFound('Recurso no encontrado.');

    const isSelf = sameId(user._id, actor.id);
    const patch = { ...data };

    // Campos inmutables vía API.
    delete patch.companyId;
    delete patch.isPlatformAdmin;

    let revokeSessions = false;

    // Contraseña: se hashea aquí (el texto plano jamás llega al repositorio).
    if (patch.password !== undefined) {
      patch.passwordHash = await hashPassword(patch.password);
      delete patch.password;
      revokeSessions = true;
    }

    // Auto-protección: no puedo cambiarme rol ni estado (evita quedar fuera).
    if (isSelf) {
      delete patch.roleId;
      delete patch.status;
    }

    // Cambio de rol: mismo tenant + utilizable + sin escalada de privilegios.
    if (patch.roleId !== undefined && !sameId(patch.roleId, user.roleId)) {
      await this._assertRoleForCompany(patch.roleId, user.companyId, actor);
      await this._assertNotLastAdmin(user, { leavingAdmin: true });
      revokeSessions = true;
    }

    // Estado: bloquear salida de "activo" invalida sesiones; reactivar limpia intentos.
    if (patch.status !== undefined && patch.status !== user.status) {
      if (patch.status !== 'active' && user.status === 'active') {
        await this._assertNotLastAdmin(user, { deactivate: true });
      }
      if (patch.status === 'active') patch.failedLoginAttempts = 0;
      revokeSessions = true;
    }

    // Sucursal: debe pertenecer a la MISMA empresa del usuario (null la limpia).
    if (patch.branchId !== undefined && patch.branchId !== null) {
      if (!user.companyId) {
        // Usuarios de plataforma no tienen sucursal: además evita que el
        // guard multiempresa del repositorio lance un error 500.
        throw ApiError.unprocessable('Los datos enviados no son válidos.', [
          { field: 'branchId', message: 'Los usuarios de plataforma no tienen sucursal.' },
        ]);
      }
      const branch = await branchRepository.findById(patch.branchId, {
        companyId: user.companyId,
      });
      if (!branch) {
        throw ApiError.unprocessable('Los datos enviados no son válidos.', [
          { field: 'branchId', message: 'La sucursal indicada no existe en la empresa.' },
        ]);
      }
    }

    if (revokeSessions) {
      patch.tokenVersion = (user.tokenVersion || 0) + 1; // cierra sesiones abiertas
    }

    return userRepository.updateById(id, patch, scopeOptions(user));
  },

  /** Borrado LÓGICO: desactiva + revoca sesiones (la auditoría queda intacta). */
  async remove(id, actor) {
    if (sameId(id, actor.id)) {
      throw ApiError.conflict('No puede eliminar su propia cuenta.');
    }
    const user = await this.getById(id, actor);
    if (!user) throw ApiError.notFound('Recurso no encontrado.');
    if (user.status === 'active') {
      await this._assertNotLastAdmin(user, { deactivate: true });
    }

    return userRepository.updateById(
      id,
      { status: 'inactive', tokenVersion: (user.tokenVersion || 0) + 1 },
      scopeOptions(user)
    );
  },

  /**
   * Guardia de integridad: la empresa nunca se queda sin administrador activo.
   * Aplica a usuarios con el rol semilla 'administrador'.
   */
  async _assertNotLastAdmin(user, { deactivate = false, leavingAdmin = false } = {}) {
    if (!user.companyId) return; // usuarios de plataforma: fuera de esta guarda
    if (user.status !== 'active') return;

    const currentRole = await roleRepository.findById(user.roleId);
    if (!currentRole || currentRole.code !== 'administrador') return;

    const adminRoles = await roleRepository.findAll({
      companyId: user.companyId,
      code: 'administrador',
    });
    const count = await userRepository.countActiveAdmins(
      user.companyId,
      adminRoles.map((r) => r._id)
    );

    const willBeZero = (deactivate || leavingAdmin) && count <= 1;
    if (willBeZero) {
      throw ApiError.conflict('No es posible desactivar al último administrador activo de la empresa.');
    }
  },
};

module.exports = userService;
