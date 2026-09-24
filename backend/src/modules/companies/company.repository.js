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

  /** Actualiza sólo claves de settings ya validadas y sin reemplazar el objeto completo. */
  async updateSettings(companyId, settings) {
    const set = Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [`settings.${key}`, value])
    );
    return this.model
      .findOneAndUpdate({ _id: companyId }, { $set: set }, { new: true, runValidators: true })
      .lean()
      .exec();
  }
}

module.exports = new CompanyRepository();
