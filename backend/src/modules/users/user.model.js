'use strict';

const mongoose = require('mongoose');

/**
 * USER — Cuenta de acceso. SIEMPRE ligada a una empresa (tenant),
 * salvo el Super Admin de plataforma (companyId = null).
 * Colección: users
 *
 * Campos sensibles:
 *  - passwordHash: nunca se devuelve (proyección por defecto lo excluye).
 *  - tokenVersion: incrementarlo invalida todos los refresh tokens emitidos.
 */
const userSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, index: true },

    name: { type: String, required: [true, 'El nombre es obligatorio.'], trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'El correo es obligatorio.'],
      unique: true, // login global único
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    passwordHash: { type: String, required: true, select: false },

    status: { type: String, enum: ['active', 'inactive', 'locked'], default: 'active' },
    isPlatformAdmin: { type: Boolean, default: false },

    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    tokenVersion: { type: Number, default: 0 },

    // Recuperación de contraseña (preparada para fase posterior).
    resetPasswordTokenHash: { type: String, select: false, default: null },
    resetPasswordExpiresAt: { type: Date, select: false, default: null },
  },
  { timestamps: true }
);

userSchema.index({ companyId: 1, status: 1 });
userSchema.index({ companyId: 1, email: 1 });
userSchema.index({ companyId: 1, roleId: 1 });

/** Serialización segura: jamás incluye hash ni tokens. */
userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.resetPasswordTokenHash;
  delete obj.resetPasswordExpiresAt;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
