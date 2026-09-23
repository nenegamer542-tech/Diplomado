'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Role = require('./role.model');

/**
 * Repositorio de ROLES.
 * requireTenant=false porque authenticate() carga el rol del usuario —
 * incluido el rol de plataforma (companyId null) del Super Admin, que no
 * tiene tenant. El SCOPE por empresa se impone en el service/list del
 * controller (tenantFilter o filtro explícito companyId: null).
 */
class RoleRepository extends BaseRepository {
  constructor() {
    super(Role, { requireTenant: false });
  }

  /** Rol por código dentro de una empresa (companyId null = plataforma). */
  async findByCode(companyId, code) {
    return this.model.findOne({ companyId: companyId ?? null, code }).lean();
  }
}

module.exports = new RoleRepository();
