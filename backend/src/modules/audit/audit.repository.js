'use strict';

const AuditLog = require('./audit.model');
const logger = require('../../config/logger');

/**
 * Repositorio de auditoría.
 * ESPECIAL: la auditoría NO usa el guard de BaseRepository porque
 * escribe desde el middleware global y puede no tener companyId aún.
 * Sí exige companyId en las LECTURAS para no filtrar entre tenants.
 */
const auditRepository = {
  async create(entry) {
    return AuditLog.create(entry);
  },

  async list(filter, { sort = { createdAt: -1 }, skip = 0, limit = 50 } = {}) {
    // Exige la CLAVE companyId: valor null explícito = alcance de PLATAFORMA
    // (entradas del Super Admin); la AUSENCIA de la clave está prohibida.
    if (!Object.prototype.hasOwnProperty.call(filter, 'companyId')) {
      throw new Error('AUDIT: lectura sin filtro companyId — prohibido (fuga entre empresas).');
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return { items, total };
  },

  async findById(id, companyId) {
    if (!companyId) throw new Error('AUDIT: findById sin companyId.');
    return AuditLog.findOne({ _id: id, companyId }).lean();
  },
};

module.exports = auditRepository;
