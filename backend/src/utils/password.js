'use strict';

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash de contraseñas. Nunca se almacena ni se loguea texto plano.
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Política básica de contraseña (el backend siempre revalida). */
function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

module.exports = { hashPassword, verifyPassword, isStrongPassword };
