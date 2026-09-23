'use strict';

const { Router } = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authLimiter } = require('../../middlewares/rateLimit');
const validate = require('../../middlewares/validate');
const schemas = require('./auth.validation');

const router = Router();

/**
 * Autenticación.
 *
 * POST /api/v1/auth/login            — público; límite estricto (fuerza bruta)
 * POST /api/v1/auth/refresh          — público; rota el par de tokens
 * POST /api/v1/auth/logout           — autenticado; logout GLOBAL (tokenVersion++)
 * GET  /api/v1/auth/me               — autenticado; usuario + rol + empresa + sucursal
 * POST /api/v1/auth/change-password  — autenticado; valida contraseña actual
 *
 * El audit middleware global EXCLUYE /auth: aquí se audita en el service
 * para registrar también los intentos fallidos (result: FAILURE).
 */

router.post('/login', authLimiter, validate({ body: schemas.loginSchema }), controller.login);

router.post('/refresh', validate({ body: schemas.refreshSchema }), controller.refresh);

router.post('/logout', authenticate, controller.logout);

router.get('/me', authenticate, controller.me);

router.post(
  '/change-password',
  authenticate,
  authLimiter,
  validate({ body: schemas.changePasswordSchema }),
  controller.changePassword
);

module.exports = router;
