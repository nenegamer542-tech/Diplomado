'use strict';

const authService = require('./auth.service');
const { ok } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

/** Metadatos de auditoría (IP y agente) comunes a todas las operaciones. */
function auditMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, auditMeta(req));
  return ok(res, data);
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body);
  return ok(res, data);
});

const logout = asyncHandler(async (req, res) => {
  const data = await authService.logout(req.user, auditMeta(req));
  return ok(res, data);
});

const me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user);
  return ok(res, data);
});

const changePassword = asyncHandler(async (req, res) => {
  const data = await authService.changePassword(req.user, req.body, auditMeta(req));
  return ok(res, data);
});

module.exports = { login, refresh, logout, me, changePassword };
