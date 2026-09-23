'use strict';

/**
 * Middleware de AUDITORÍA global.
 *
 * Registra operaciones críticas (mutaciones) de forma asíncrona y NO bloqueante:
 * si el registro de auditoría falla, la operación del usuario no se revierte,
 * pero el fallo sí se loguea (ver ADR-005 en docs/architecture/decisions.md).
 *
 * Se monta después de authenticate; solo actúa sobre POST/PUT/PATCH/DELETE
 * en rutas bajo /api/v1 que no sean /auth.
 */

const auditService = require('../modules/audit/audit.service');
const logger = require('../config/logger');

// Rutas que no generan auditoría propia (ya la hace su service).
const EXCLUDE = [/^\/api\/v1\/auth/];

function shouldAudit(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return false;
  return !EXCLUDE.some((re) => re.test(req.originalUrl || req.url));
}

function extractModule(req) {
  const url = req.originalUrl || req.url || '';
  const match = url.match(/\/api\/v1\/([a-z-]+)/);
  return match ? match[1] : 'unknown';
}

function extractResourceId(req) {
  // Los controllers pueden indicar el recurso recién creado (p.ej. movimientos
  // de inventario, cuyo ID no existe en URL ni en el body de la petición).
  return req.auditResourceId || req.params?.id || req.body?.id || null;
}

module.exports = function auditMiddleware(req, res, next) {
  if (!shouldAudit(req)) return next();

  // Interceptamos la respuesta para conocer el resultado real.
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const okResponse = res.statusCode < 400;
    auditService
      .log({
        userId: req.user?.id || null,
        companyId: req.user?.companyId || null,
        module: extractModule(req),
        action: `${req.method}_${extractModule(req).toUpperCase()}`,
        resourceId: extractResourceId(req),
        before: req.auditBefore || null,
        after: okResponse && req.body ? sanitize(req.body) : null,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        result: okResponse ? 'SUCCESS' : 'FAILURE',
        statusCode: res.statusCode,
      })
      .catch((err) => logger.error({ err: err.message }, 'Fallo al registrar auditoría'));

    return originalJson(payload);
  };

  next();
};

/** Evita registrar contraseñas/tokens en la auditoría. */
function sanitize(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...body };
  for (const key of Object.keys(clone)) {
    if (/password|token|secret/i.test(key)) clone[key] = '[REDACTED]';
  }
  return clone;
}
