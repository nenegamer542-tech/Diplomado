'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Company = require('./company.model');

/**
 * Repositorio de EMPRESAS.
 * requireTenant=false: companies es la entidad RAÍZ de plataforma; es la
 * referencia contra la que se filtran los demás módulos (no puede exigirse
 * companyId "de sí misma"). El control de propiedad se aplica en el service:
 * un usuario solo opera sobre su propia empresa; el Super Admin, sobre todas.
 */
class CompanyRepository extends BaseRepository {
  constructor() {
    super(Company, { requireTenant: false });
  }
}

module.exports = new CompanyRepository();
