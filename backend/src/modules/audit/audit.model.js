'use strict';

const mongoose = require('mongoose');

/**
 * AUDIT_LOG — Bitácora inmutable de operaciones críticas.
 * Colección: audit_logs
 *
 * Reglas:
 *  - NO expone endpoint de creación/edición/borrado vía API.
 *  - Sólo lectura (permiso audit.read) con filtros.
 *  - El usuario normal NO puede eliminarla (no hay ruta DELETE).
 *  - before/after guardan el estado para trazabilidad.
 */
const auditLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userEmail: { type: String, default: null },

    module: { type: String, required: true, maxlength: 40, index: true },
    action: { type: String, required: true, maxlength: 60 },
    resourceType: { type: String, default: null, maxlength: 40 },
    resourceId: { type: String, default: null, maxlength: 64 },

    before: { type: Object, default: null },
    after: { type: Object, default: null },

    ip: { type: String, default: null, maxlength: 60 },
    userAgent: { type: String, default: null, maxlength: 240 },

    result: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS', index: true },
    statusCode: { type: Number, default: null },
    message: { type: String, default: null, maxlength: 300 },

    // Retención: si contiene una fecha, MongoDB elimina el documento (TTL).
    // null = retención indefinida (default).
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, module: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
// TTL: sólo borra documentos cuyo expiresAt sea una fecha (Mongo ignora null).
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Inmutabilidad de la bitácora a nivel de modelo: ni updates ni borrados
// vía Mongoose. (El TTL del servidor no pasa por estos hooks.)
auditLogSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
    'findOneAndRemove',
  ],
  function immutableAudit() {
    throw new Error('AUDIT_LOG inmutable: escritura o eliminación prohibida.');
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
