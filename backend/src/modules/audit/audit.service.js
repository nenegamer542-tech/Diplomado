'use strict';

const auditRepository = require('./audit.repository');
const logger = require('../../config/logger');

/**
 * Servicio de auditoría (transversal).
 *
 * Política (ADR-005):
 *  - `log()` NUNCA lanzа error al llamador: un fallo de auditoría no debe
 *    romper la operación del usuario, pero sí debe quedar en logs internos.
 *  - `logOrFail()` sí propaga, para operaciones donde la auditoría es
 *    parte de la transacción (futuro: transacciones de Mongo).
 *  - Redacta campos sensibles antes de persistir.
 */
const SENSITIVE = /password|token|secret|hash/i;

function redact(obj) {
  // `undefined` debe persistirse como `null` (default del documento de auditoría).
  if (obj === undefined) return null;
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE.test(k) ? '[REDACTED]' : typeof v === 'object' ? redact(v) : v;
  }
  return out;
}

const auditService = {
  /**
   * Registra una operación crítica de forma no bloqueante.
   * @param {object} entry
   * @param {string|null} entry.userId
   * @param {string|null} entry.companyId
   * @param {string} entry.module
   * @param {string} entry.action   ej. CREATE_PRODUCT, UPDATE_USER
   * @param {string|null} entry.resourceId
   * @param {object|null} [entry.before] - estado previo
   * @param {object|null} [entry.after]  - estado nuevo
   * @param {string} [entry.result]  SUCCESS | FAILURE
   */
  async log(entry) {
    try {
      await auditRepository.create({
        companyId: entry.companyId || null,
        userId: entry.userId || null,
        userEmail: entry.userEmail || null,
        module: entry.module,
        action: entry.action,
        resourceType: entry.resourceType || null,
        resourceId: entry.resourceId || null,
        before: redact(entry.before),
        after: redact(entry.after),
        ip: entry.ip || null,
        userAgent: entry.userAgent || null,
        result: entry.result || 'SUCCESS',
        statusCode: entry.statusCode || null,
        message: entry.message || null,
      });
    } catch (err) {
      logger.error({ err: err.message, module: entry.module, action: entry.action }, 'Auditoría no registrada');
    }
  },

  /** Igual que log() pero propaga el error (uso crítico futuro). */
  async logOrFail(entry) {
    await auditRepository.create({
      ...entry,
      before: redact(entry.before),
      after: redact(entry.after),
    });
  },

  async list(filter, options) {
    return auditRepository.list(filter, options);
  },

  async findById(id, companyId) {
    return auditRepository.findById(id, companyId);
  },
};

module.exports = auditService;
