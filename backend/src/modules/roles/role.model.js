'use strict';

const mongoose = require('mongoose');

/**
 * ROLE — Rol con permisos granulares, dentro de una empresa.
 * Colección: roles
 * companyId null => rol de plataforma (ej. super_admin).
 *
 * Los permisos son CÓDIGOS del catálogo en config/permissions.js (ADR-002).
 */
const roleSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    code: { type: String, required: [true, 'El código es obligatorio.'], trim: true, lowercase: true, maxlength: 40 },
    label: { type: String, required: [true, 'El nombre visible es obligatorio.'], trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 240 },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.every((p) => typeof p === 'string' && /^[a-z][a-z0-9_.]*$/.test(p)),
        message: 'Permiso inválido en el rol.',
      },
    },
    isSystem: { type: Boolean, default: false }, // roles sembrados, no editables por UI
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

// Código único por empresa (o global si companyId es null).
roleSchema.index({ companyId: 1, code: 1 }, { unique: true });
roleSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Role', roleSchema);
