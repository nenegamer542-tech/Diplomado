'use strict';

const mongoose = require('mongoose');

/**
 * EMPLOYEE — Empleado de una empresa (RRHH).
 * Colección: employees (siempre companyId-scoped)
 *
 * Ciclo de vida (ADR-012): sin `.delete`; la baja se hace cambiando
 * `status` a inactive (la reactivación vuelve a active).
 * `documentId` (documento de identidad) es la clave única POR empresa.
 */
const employeeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    documentId: { type: String, required: 'El documento de identidad es obligatorio.', trim: true, maxlength: 30 },
    firstName: { type: String, required: 'El nombre es obligatorio.', trim: true, maxlength: 80 },
    lastName: { type: String, required: 'El apellido es obligatorio.', trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: null },
    position: { type: String, trim: true, maxlength: 80, default: null },
    department: { type: String, trim: true, maxlength: 80, default: null },
    hireDate: { type: Date, required: true, default: Date.now },
    salary: { type: Number, min: [0, 'El salario no puede ser negativo.'], default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    terminationDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, strict: true }
);

employeeSchema.index({ companyId: 1, documentId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, status: 1, createdAt: -1 });
employeeSchema.index({ companyId: 1, department: 1 });
employeeSchema.index({ companyId: 1, lastName: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
