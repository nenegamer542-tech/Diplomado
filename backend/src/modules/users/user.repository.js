'use strict';

const BaseRepository = require('../../common/BaseRepository');
const User = require('./user.model');

/**
 * Repositorio de USUARIOS.
 * requireTenant=false porque authenticate() busca por _id partiendo de un
 * token YA verificado (el Super Admin de plataforma tiene companyId null).
 * El SCOPE por empresa se impone SIEMPRE en el service a partir del token
 * (nunca del request del cliente).
 *
 * passwordHash tiene select:false: sólo se pide explícitamente en login.
 */
class UserRepository extends BaseRepository {
  constructor() {
    super(User, { requireTenant: false });
  }

  /** Login: único punto donde se solicita el hash. */
  async findByEmail(email) {
    return this.model.findOne({ email }).select('+passwordHash').lean();
  }

  async countByBranch(branchId) {
    return this.model.countDocuments({ branchId });
  }

  async countByRole(roleId) {
    return this.model.countDocuments({ roleId });
  }

  /** Usuarios activos con alguno de los roles administrativos indicados. */
  async countActiveAdmins(companyId, adminRoleIds) {
    if (!companyId) return 0;
    return this.model.countDocuments({
      companyId,
      status: 'active',
      roleId: { $in: adminRoleIds },
    });
  }

  /** Control de fuerza bruta: incrementa intentos fallidos de login. */
  async bumpFailedAttempts(id) {
    return this.model.updateOne({ _id: id }, { $inc: { failedLoginAttempts: 1 } }).exec();
  }

  /** Login correcto: limpia contadores y marca último acceso. */
  async resetLoginFailures(id) {
    return this.model
      .updateOne({ _id: id }, { $set: { failedLoginAttempts: 0, lastLoginAt: new Date() } })
      .exec();
  }

  /** Logout global / revocación: invalida todos los refresh tokens emitidos. */
  async bumpTokenVersion(id) {
    return this.model.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } }).exec();
  }
}

module.exports = new UserRepository();
