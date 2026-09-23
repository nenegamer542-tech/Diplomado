'use strict';

const ApiError = require('../../utils/ApiError');
const budgetRepository = require('./budget.repository');

/**
 * Servicio de PRESUPUESTOS (FASE 5) — multiempresa estricto.
 *
 * Reglas (ADR-011):
 *  - companyId SIEMPRE del token; ID ajeno => 404.
 *  - Clave única por (año, mes, categoría): duplicado ⇒ 409 canónico.
 *  - Sólo guarda lo planeado; lo ejecutado se calcula en /reports/budgets.
 */
const budgetService = {
  async list(filter, options) {
    return budgetRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return budgetRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    // La clave de unicidad es EXCLUSIVAMENTE (year, month, category):
    // no se pasa el cuerpo completo para que el repo nunca pueda filtrar
    // por campos que no son clave (p.ej. plannedAmount distinto).
    const key = { year: data.year, month: data.month, category: data.category };
    const existing = await budgetRepository.findByKey(companyId, key);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: year, month, category.', {
        fields: ['year', 'month', 'category'],
      });
    }
    return budgetRepository.create({ ...data, companyId, createdBy: userId || null });
  },

  async update(id, data, companyId) {
    const budget = await budgetRepository.findById(id, { companyId });
    if (!budget) throw ApiError.notFound('Recurso no encontrado.');

    const key = {
      year: data.year !== undefined ? data.year : budget.year,
      month: data.month !== undefined ? data.month : budget.month,
      category: data.category !== undefined ? data.category : budget.category,
    };
    const existing = await budgetRepository.findByKey(companyId, key);
    if (existing && String(existing._id) !== id) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: year, month, category.', {
        fields: ['year', 'month', 'category'],
      });
    }

    return budgetRepository.updateById(id, data, { companyId });
  },

  async remove(id, companyId) {
    const budget = await budgetRepository.findById(id, { companyId });
    if (!budget) throw ApiError.notFound('Recurso no encontrado.');
    return budgetRepository.deleteById(id, { companyId });
  },
};

module.exports = budgetService;
