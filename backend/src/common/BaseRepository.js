'use strict';

const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * REPOSITORIO BASE — única puerta de entrada a MongoDB.
 *
 * Responsabilidades:
 *  - Aislar a Mongoose de service/controllers.
 *  - Aplicar SIEMPRE el filtro de tenant (companyId) en entidades de negocio.
 *  - Centralizar paginación y proyecciones (nunca devolver passwordHash).
 *
 * Entidades de plataforma (companies, roles globales) usan requireTenant=false.
 */
class BaseRepository {
  /**
   * @param {mongoose.Model} model
   * @param {object} [options]
   * @param {boolean} [options.requireTenant=true] - exige companyId en cada query.
   */
  constructor(model, options = {}) {
    this.model = model;
    this.requireTenant = options.requireTenant !== false;
  }

  /**
   * Garantiza el aislamiento: lanza si falta companyId cuando es obligatorio.
   */
  _guard(filter = {}) {
    if (this.requireTenant && !filter.companyId) {
      // Error de programación, no de usuario: debe fallar ruidosamente en dev/test.
      throw new Error(
        `REPOSITORIO ${this.model.modelName}: query sin companyId — riesgo de fuga entre empresas.`
      );
    }
    return filter;
  }

  async findById(id, { companyId, projection } = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;
    // _guard lanza (error ruidoso) si requireTenant y falta companyId.
    this._guard(filter);
    return this.model.findOne(filter).select(projection).lean();
  }

  async findOne(filter, projection) {
    return this.model.findOne(this._guard(filter)).select(projection).lean();
  }

  async find(filter = {}, { sort = { createdAt: -1 }, skip = 0, limit = 20, projection } = {}) {
    const guarded = this._guard(filter);
    const [items, total] = await Promise.all([
      this.model.find(guarded).select(projection).sort(sort).skip(skip).limit(limit).lean(),
      this.model.countDocuments(guarded),
    ]);
    return { items, total };
  }

  async findAll(filter = {}, { sort = { createdAt: -1 }, projection } = {}) {
    return this.model.find(this._guard(filter)).select(projection).sort(sort).lean();
  }

  async create(data) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updateById(id, data, { companyId } = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;
    this._guard(filter);
    return this.model
      .findOneAndUpdate(filter, { $set: data }, { new: true, runValidators: true })
      .lean();
  }

  async deleteById(id, { companyId } = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;
    this._guard(filter);
    return this.model.findOneAndDelete(filter).lean();
  }

  async exists(filter) {
    return this.model.exists(this._guard(filter));
  }

  /** Documento "before" para auditoría. */
  async getSnapshot(id, { companyId } = {}) {
    return this.findById(id, { companyId });
  }
}

module.exports = BaseRepository;
