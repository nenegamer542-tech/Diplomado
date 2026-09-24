'use strict';

const mongoose = require('mongoose');

/**
 * COMPANY — Tenant raíz del sistema multiempresa.
 * Colección: companies
 * Nota: los usuarios NO se guardan aquí; la relación es users.companyId -> companies._id
 */
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'El nombre es obligatorio.'], trim: true, maxlength: 120 },
    legalName: { type: String, trim: true, maxlength: 160 },
    taxId: { type: String, trim: true, maxlength: 30 }, // RFC/NIT/CIF/etc.
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 240 },
    currency: { type: String, default: 'MXN', trim: true, uppercase: true, maxlength: 3 },
    currencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterData', default: null },
    timezone: { type: String, default: 'America/Mexico_City', maxlength: 60 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    settings: { type: Object, default: {} },
    // Marca de plataforma: las empresas son globales (no llevan companyId).
    isPlatformEntity: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companySchema.index({ name: 1 }, { unique: true });
companySchema.index({ taxId: 1 }, { sparse: true });
companySchema.index({ status: 1 });

module.exports = mongoose.model('Company', companySchema);
