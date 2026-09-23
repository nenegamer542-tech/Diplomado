'use strict';

const ApiError = require('../../utils/ApiError');
const leadRepository = require('./lead.repository');
const userRepository = require('../users/user.repository');

/**
 * Servicio de CRM / LEADS (FASE 6) — multiempresa estricto, sin borrado físico.
 *
 * Reglas (ADR-012):
 *  - companyId SALE SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - Sin DELETE: la baja es un cambio de estado del ciclo de vida.
 *  - Ciclo: NEW → CONTACTED → QUALIFIED → WON | LOST.
 *    WON y LOST son terminales: un lead cerrado no admite modificaciones.
 */
const TRANSITIONS = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

async function loadAssigned(userId, companyId) {
  if (!userId) return null;
  const user = await userRepository.findById(userId, { companyId });
  if (!user) throw ApiError.notFound('Recurso no encontrado.');
  return user;
}

const leadService = {
  async list(filter, options) {
    return leadRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return leadRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const assigned = await loadAssigned(data.assignedTo, companyId);

    return leadRepository.create({
      companyId,
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      source: data.source || 'other',
      status: data.status || 'NEW',
      expectedAmount: data.expectedAmount ?? 0,
      notes: data.notes || null,
      assignedTo: assigned ? assigned._id : null,
      createdBy: userId || null,
    });
  },

  async update(id, data, companyId) {
    const lead = await leadRepository.findById(id, { companyId });
    if (!lead) throw ApiError.notFound('Recurso no encontrado.');
    if (lead.status === 'WON' || lead.status === 'LOST') {
      throw ApiError.conflict('El lead está cerrado; no admite modificaciones.');
    }

    const patch = {};
    if (data.status !== undefined && data.status !== lead.status) {
      const allowed = TRANSITIONS[lead.status] || [];
      if (!allowed.includes(data.status)) {
        throw ApiError.conflict('La transición de estado no está permitida.');
      }
      patch.status = data.status;
    }
    for (const field of ['name', 'company', 'email', 'phone', 'source', 'expectedAmount', 'notes']) {
      if (data[field] !== undefined) patch[field] = data[field];
    }
    if (data.assignedTo !== undefined) {
      const assigned = await loadAssigned(data.assignedTo, companyId);
      patch.assignedTo = assigned ? assigned._id : null;
    }

    return leadRepository.updateById(id, patch, { companyId });
  },
};

module.exports = leadService;
