'use strict';

/**
 * Guardia de AISLAMIENTO MULTIEMPRESA.
 *
 * Toda query sobre datos de negocio DEBE filtrar por companyId.
 * Este helper centraliza la construcción del filtro y falla de forma ruidosa
 * (Error, no silencio) si alguien olvida el tenant.
 *
 * Un usuario jamás accede a datos de otra empresa aunque manipule el ID en la URL:
 * el filtro se inyecta desde el token, nunca desde el cliente.
 */
const ApiError = require('../utils/ApiError');

/**
 * Construye el filtro tenant obligatorio.
 * @param {object} req - Request con req.user autenticado.
 * @param {object} [extra] - Filtro adicional (estado, búsqueda...).
 * @returns {object} filtro garantizado con companyId.
 */
function tenantFilter(req, extra = {}) {
  const companyId = req.user?.companyId;

  // Super Admin de plataforma puede consultar sin tenant solo si es explícito.
  if (!companyId) {
    if (req.user?.isPlatformAdmin && req.query.allCompanies === 'true') {
      return { ...extra };
    }
    throw ApiError.forbidden('Operación no disponible fuera del contexto de una empresa.');
  }

  // El token MANDA: `extra` no puede pisar companyId (aislamiento estricto).
  return { ...extra, companyId };
}

/**
 * Verifica explícitamente que un documento pertenezca al tenant actual.
 * Se usa en rutas con :id para impedir acceso cruzado (IDOR/tenant hop).
 */
function assertOwnership(req, doc) {
  if (!doc) return; // 404 lo decide el service.
  const docCompany = doc.companyId ? String(doc.companyId) : null;
  const userCompany = req.user?.companyId ? String(req.user.companyId) : null;

  const isPlatformAdmin = req.user?.isPlatformAdmin;
  if (isPlatformAdmin && !userCompany) return;

  if (!docCompany || docCompany !== userCompany) {
    throw ApiError.notFound('Recurso no encontrado.');
  }
}

module.exports = { tenantFilter, assertOwnership };
