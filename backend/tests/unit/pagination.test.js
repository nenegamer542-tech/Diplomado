'use strict';

const { parsePagination, buildMeta, MAX_LIMIT } = require('../../src/utils/pagination');

describe('parsePagination', () => {
  test('valores por defecto', () => {
    expect(parsePagination({})).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      sort: { createdAt: -1 },
    });
  });

  test('limit se recorta al máximo', () => {
    expect(parsePagination({ limit: '500' }).limit).toBe(MAX_LIMIT);
    expect(parsePagination({ limit: '0' }).limit).toBe(1);
    expect(parsePagination({ limit: 'abc' }).limit).toBe(20);
  });

  test('page inválida o negativa cae en 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-9' }).page).toBe(1);
    expect(parsePagination({ page: 'xyz' }).page).toBe(1);
  });

  test('skip se calcula correctamente', () => {
    expect(parsePagination({ page: '3', limit: '10' }).skip).toBe(20);
  });

  test('sortBy fuera de la whitelist se ignora (previene inyección de sort)', () => {
    expect(parsePagination({ sortBy: '$where', sortDir: 'desc' }).sort).toEqual({ createdAt: -1 });
    expect(parsePagination({ sortBy: '1;drop' }).sort).toEqual({ createdAt: -1 });
  });

  test('sortBy válido aplica sortDir', () => {
    expect(parsePagination({ sortBy: 'name', sortDir: 'desc' }).sort).toEqual({ name: -1 });
    expect(parsePagination({ sortBy: 'name' }).sort).toEqual({ name: 1 });
  });
});

describe('buildMeta', () => {
  test('calcula totalPages', () => {
    expect(buildMeta(2, 20, 45)).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });

  test('total 0 => al menos 1 página', () => {
    expect(buildMeta(1, 20, 0).totalPages).toBe(1);
  });
});
