'use strict';

/**
 * Contador secuencial POR EMPRESA (ADR-009).
 *
 * Genera códigos humanos de documentos (PO-000001, SO-000001) con un
 * `findOneAndUpdate` + `$inc` ATÓMICO (upsert): dos peticiones simultáneas
 * nunca reciben el mismo número, sin necesidad de transacciones.
 *
 * El filtro SIEMPRE lleva companyId (guard ruido igual que BaseRepository,
 * ADR-004): la numeración no se comparte jamás entre empresas.
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    key: { type: String, required: true, maxlength: 40 },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false, strict: true }
);

counterSchema.index({ companyId: 1, key: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);

/**
 * @param {string} companyId - tenant (obligatorio).
 * @param {string} key - espacio de nombres (p.ej. 'purchase_orders').
 * @returns {Promise<number>} siguiente número (>= 1).
 */
async function nextSequence(companyId, key) {
  if (!companyId) {
    throw new Error(`CONTADOR ${key}: nextSequence sin companyId — riesgo de numeración cruzada.`);
  }
  const doc = await Counter.findOneAndUpdate(
    { companyId, key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return doc.seq;
}

/** Formatea el número en código de documento (p.ej. 7 → 'PO-000007'). */
function formatCode(prefix, seq) {
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

module.exports = { Counter, nextSequence, formatCode };
