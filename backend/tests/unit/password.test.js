'use strict';

const { hashPassword, verifyPassword, isStrongPassword } = require('../../src/utils/password');

describe('hashPassword / verifyPassword', () => {
  test('el hash no contiene la contraseña y verifica correctamente', async () => {
    const hash = await hashPassword('Clave1234!');
    expect(hash).not.toContain('Clave1234!');
    expect(await verifyPassword('Clave1234!', hash)).toBe(true);
  });

  test('contraseña incorrecta → false', async () => {
    const hash = await hashPassword('Clave1234!');
    expect(await verifyPassword('clave1234!', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  test('mismo input produce hashes distintos (salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('Clave1234!'), hashPassword('Clave1234!')]);
    expect(a).not.toBe(b);
  });

  test('verifyPassword sin hash → false (nunca lanza)', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', undefined)).toBe(false);
  });
});

describe('isStrongPassword (política backend)', () => {
  test('acepta ≥8 con letras y números', () => {
    expect(isStrongPassword('abcdef12')).toBe(true);
    expect(isStrongPassword('Clave1234!')).toBe(true);
  });

  test('rechaza cortas, sin números o sin letras', () => {
    expect(isStrongPassword('abc123')).toBe(false); // corta
    expect(isStrongPassword('abcdefgh')).toBe(false); // sin dígitos
    expect(isStrongPassword('12345678')).toBe(false); // sin letras
    expect(isStrongPassword('')).toBe(false);
    expect(isStrongPassword(undefined)).toBe(false);
  });
});
