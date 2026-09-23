'use strict';

const { z, email } = require('../../utils/validators');
const { passwordSchema } = require('../users/user.validation');

const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'La contraseña es obligatoria.').max(100),
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(10, 'Refresh token inválido.').max(2000),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria.').max(100),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((b) => b.currentPassword !== b.newPassword, {
    path: ['newPassword'],
    message: 'La nueva contraseña debe ser distinta a la actual.',
  });

module.exports = { loginSchema, refreshSchema, changePasswordSchema };
