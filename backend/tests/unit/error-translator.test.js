'use strict';

const ApiError = require('../../src/utils/ApiError');
const {
  rethrowDuplicate,
  rethrowValidation,
  withTranslatedErrors,
  isDuplicateKeyError,
} = require('../../src/common/errorTranslator');

describe('isDuplicateKeyError', () => {
  test('detecta el código 11000 de Mongo', () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isDuplicateKeyError({ code: 11001 })).toBe(false);
    expect(isDuplicateKeyError(new Error('x'))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});

describe('rethrowDuplicate', () => {
  test('convierte 11000 en ApiError 409 con los campos', () => {
    const err = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000,
      keyValue: { email: 'a@b.c' },
    });

    let caught;
    try {
      rethrowDuplicate(err, 'a@b.c');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.statusCode).toBe(409);
    expect(caught.message).toContain('email');
    expect(caught.details.fields).toEqual(['email']);
  });

  test('errores no-duplicado se re-lanzan tal cual', () => {
    const err = new Error('otro error');
    expect(() => rethrowDuplicate(err)).toThrow('otro error');
  });
});

describe('rethrowValidation', () => {
  test('ValidationError de Mongoose → 422 legible', () => {
    const err = {
      name: 'ValidationError',
      errors: { name: { message: 'El nombre es obligatorio.' } },
    };

    let caught;
    try {
      rethrowValidation(err);
    } catch (e) {
      caught = e;
    }

    expect(caught.statusCode).toBe(422);
    expect(caught.message).toBe('Los datos enviados no son válidos.');
    expect(caught.details[0]).toEqual({ field: 'name', message: 'El nombre es obligatorio.' });
  });

  test('errores normales se re-lanzan', () => {
    const err = new Error('boom');
    expect(() => rethrowValidation(err)).toThrow('boom');
  });
});

describe('withTranslatedErrors', () => {
  test('traduce duplicados dentro de la promesa', async () => {
    const dup = Object.assign(new Error('dup'), { code: 11000, keyValue: { code: 'MAIN' } });
    await expect(withTranslatedErrors(() => Promise.reject(dup))).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('devuelve el resultado cuando no hay error', async () => {
    await expect(withTranslatedErrors(async () => 42)).resolves.toBe(42);
  });
});
