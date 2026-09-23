'use strict';

const BaseRepository = require('../../src/common/BaseRepository');

const VALID_ID = '64b000000000000000000001';

/** Modelo Mongoose simulado: captura findOne y devuelve una cadena encadenable. */
function makeModel() {
  const query = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(null),
  };
  return {
    modelName: 'Demo',
    findOne: jest.fn(() => query),
    __query: query,
  };
}

describe('BaseRepository — guardia multiempresa', () => {
  test('_guard falla ruidosamente si requireTenant y falta companyId', () => {
    const repo = new BaseRepository(makeModel());
    expect(() => repo._guard({})).toThrow(/companyId/);
    expect(() => repo._guard({ companyId: 'c1' })).not.toThrow();
  });

  test('_guard no aplica cuando requireTenant=false', () => {
    const repo = new BaseRepository(makeModel(), { requireTenant: false });
    expect(() => repo._guard({})).not.toThrow();
  });

  test('findById SIN companyId en repo tenant → rechaza antes de consultar', async () => {
    const model = makeModel();
    const repo = new BaseRepository(model); // requireTenant por defecto

    await expect(repo.findById(VALID_ID)).rejects.toThrow(/companyId/);
    expect(model.findOne).not.toHaveBeenCalled(); // nunca llegó a Mongo
  });

  test('findById CON companyId → filtro { _id, companyId }', async () => {
    const model = makeModel();
    const repo = new BaseRepository(model);

    await repo.findById(VALID_ID, { companyId: 'company1' });
    expect(model.findOne).toHaveBeenCalledWith({ _id: VALID_ID, companyId: 'company1' });
  });

  test('repo sin tenant: findById sin companyId → sólo { _id }', async () => {
    const model = makeModel();
    const repo = new BaseRepository(model, { requireTenant: false });

    await repo.findById(VALID_ID);
    expect(model.findOne).toHaveBeenCalledWith({ _id: VALID_ID });
  });

  test('ObjectId inválido → null sin tocar la base de datos', async () => {
    const model = makeModel();
    const repo = new BaseRepository(model, { requireTenant: false });

    expect(await repo.findById('no-es-un-id')).toBeNull();
    expect(model.findOne).not.toHaveBeenCalled();
  });

  test('create devuelve el documento plano (toObject)', async () => {
    const doc = { name: 'x' };
    const model = {
      modelName: 'Demo',
      create: jest.fn().mockResolvedValue({ toObject: () => doc }),
    };
    const repo = new BaseRepository(model, { requireTenant: false });

    expect(await repo.create({ name: 'x' })).toEqual(doc);
    expect(model.create).toHaveBeenCalledWith({ name: 'x' });
  });
});
