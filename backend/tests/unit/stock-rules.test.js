'use strict';

/**
 * Reglas de STOCK (ADR-008) — FASE 3.
 *
 * 1. Repositorio: operaciones atómicas con filtro de tenant SIEMPRE;
 *    decremento condicional con { quantity: { $gte } }; setExact optimista;
 *    createIfAbsent absorbe la carrera 11000.
 * 2. Service: 409 ante stock insuficiente/carrera y COMPENSACIÓN inversa
 *    si la creación del movimiento falla (sin transacciones multi-doc).
 */

jest.mock('../../src/config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../src/modules/products/product.repository', () => ({
  findById: jest.fn(),
  findAll: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../src/modules/warehouses/warehouse.repository', () => ({
  findById: jest.fn(),
  findAll: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../src/modules/inventory/stock_level.repository', () => ({
  find: jest.fn(),
  getOne: jest.fn(),
  increment: jest.fn(),
  decrementConditional: jest.fn(),
  setExact: jest.fn(),
  createIfAbsent: jest.fn(),
  deleteById: jest.fn(),
}));
jest.mock('../../src/modules/inventory/inventory_movement.repository', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

const stockLevelRepository = require('../../src/modules/inventory/stock_level.repository');
const inventoryMovementRepository = require('../../src/modules/inventory/inventory_movement.repository');
const productRepository = require('../../src/modules/products/product.repository');
const warehouseRepository = require('../../src/modules/warehouses/warehouse.repository');
const inventoryService = require('../../src/modules/inventory/inventory.service');

// Clase REAL del repositorio (el require de arriba está mockeado): se usa para
// verificar la atomicidad y la guardia de tenant sobre el código de producción.
const RealStockLevelRepository = Object.getPrototypeOf(
  jest.requireActual('../../src/modules/inventory/stock_level.repository')
);

const COMPANY = '64b000000000000000000001';
const PRODUCT_ID = '64b000000000000000000010';
const WAREHOUSE_A = '64b000000000000000000020';
const WAREHOUSE_B = '64b000000000000000000021';

const actor = { companyId: COMPANY, userId: '64b000000000000000000099' };

const activeProduct = { _id: PRODUCT_ID, sku: 'SKU-1', status: 'active' };
const activeWarehouseA = { _id: WAREHOUSE_A, status: 'active' };
const activeWarehouseB = { _id: WAREHOUSE_B, status: 'active' };

function resetMocks() {
  // resetAllMocks (no clear): además de los contadores, elimina implementaciones
  // residuales de tests anteriores ⇒ cada test define su propio estado.
  jest.resetAllMocks();
  productRepository.findById.mockResolvedValue(activeProduct);
  warehouseRepository.findById.mockImplementation(async (id) =>
    String(id) === WAREHOUSE_B ? activeWarehouseB : activeWarehouseA
  );
}

beforeEach(resetMocks);

// ---------------------------------------------------------------------------
// 1) Repositorio: atomicidad y guardia de tenant
// ---------------------------------------------------------------------------
describe('StockLevelRepository — guardia y operaciones atómicas', () => {
  // Instancia de la clase REAL con el modelo simulado: verifica la atomicidad
  // del código de producción sin tocar Mongoose.
  function repoWithModel(model) {
    const repo = Object.create(RealStockLevelRepository);
    repo.model = model;
    repo.requireTenant = true;
    return repo;
  }

  function chain(result) {
    return { lean: jest.fn().mockResolvedValue(result) };
  }

  test('todas las operaciones exigen companyId (fuga entre tenants imposible)', () => {
    const repo = repoWithModel({});
    expect(() => repo._guard({})).toThrow(/companyId/);
    expect(() => repo._guard({ companyId: COMPANY })).not.toThrow();
  });

  test('decrementConditional exige quantity >= n en el filtro y $inc negativo', async () => {
    const findOneAndUpdate = jest.fn(() => chain({ quantity: 7 }));
    const repo = repoWithModel({ findOneAndUpdate });

    await repo.decrementConditional(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      3
    );

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      {
        companyId: COMPANY,
        warehouseId: WAREHOUSE_A,
        productId: PRODUCT_ID,
        quantity: { $gte: 3 },
      },
      { $inc: { quantity: -3 } },
      { new: true }
    );
  });

  test('decrementConditional devuelve null cuando no alcanza el stock', async () => {
    const repo = repoWithModel({ findOneAndUpdate: jest.fn(() => chain(null)) });
    const result = await repo.decrementConditional(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      999
    );
    expect(result).toBeNull();
  });

  test('setExact sólo escribe si coincide el valor esperado (optimista)', async () => {
    const findOneAndUpdate = jest.fn(() => chain({ quantity: 12 }));
    const repo = repoWithModel({ findOneAndUpdate });

    await repo.setExact(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      10,
      12
    );

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID, quantity: 10 },
      { $set: { quantity: 12 } },
      { new: true }
    );
  });

  test('increment usa upsert + $inc (entradas sobre fila inexistente)', async () => {
    const findOneAndUpdate = jest.fn(() => chain({ quantity: 5 }));
    const repo = repoWithModel({ findOneAndUpdate });

    await repo.increment(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      5
    );

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      { $inc: { quantity: 5 } },
      { upsert: true, new: true }
    );
  });

  test('createIfAbsent devuelve null en la carrera 11000 y propaga otros errores', async () => {
    const raceError = Object.assign(new Error('dup'), { code: 11000 });
    const repo = repoWithModel({
      create: jest.fn().mockRejectedValueOnce(raceError).mockRejectedValueOnce(new Error('boom')),
    });

    const data = { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID, quantity: 1 };
    expect(await repo.createIfAbsent(data)).toBeNull();
    await expect(repo.createIfAbsent(data)).rejects.toThrow('boom');
  });
});

// ---------------------------------------------------------------------------
// 2) Service: reglas de negocio + compensaciones
// ---------------------------------------------------------------------------
describe('inventory.service — entrada (ENTRY)', () => {
  test('crea el movimiento con saldos before/after correctos', async () => {
    stockLevelRepository.increment.mockResolvedValue({ quantity: 15 }); // 10 + 5
    inventoryMovementRepository.create.mockResolvedValue({ _id: 'm1', type: 'ENTRY' });

    const movement = await inventoryService.entry(
      { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 5 },
      actor
    );

    expect(movement._id).toBe('m1');
    expect(inventoryMovementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        type: 'ENTRY',
        quantity: 5,
        delta: 5,
        quantityBefore: 10,
        quantityAfter: 15,
        userId: actor.userId,
      })
    );
  });

  test('si el movimiento falla, se COMPENSA descontando el stock incrementado', async () => {
    stockLevelRepository.increment.mockResolvedValue({ quantity: 5 });
    inventoryMovementRepository.create.mockRejectedValue(new Error('db down'));
    stockLevelRepository.decrementConditional.mockResolvedValue({ quantity: 0 });

    await expect(
      inventoryService.entry(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 5 },
        actor
      )
    ).rejects.toThrow('db down');

    expect(stockLevelRepository.decrementConditional).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      5
    );
  });

  test('producto de otra empresa → 404 (nunca 403)', async () => {
    productRepository.findById.mockResolvedValue(null);
    await expect(
      inventoryService.entry(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 1 },
        actor
      )
    ).rejects.toMatchObject({ statusCode: 404, message: 'Recurso no encontrado.' });
    expect(stockLevelRepository.increment).not.toHaveBeenCalled();
  });

  test('producto inactivo → 409, sin tocar stock', async () => {
    productRepository.findById.mockResolvedValue({ _id: PRODUCT_ID, status: 'inactive' });
    await expect(
      inventoryService.entry(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 1 },
        actor
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(stockLevelRepository.increment).not.toHaveBeenCalled();
  });
});

describe('inventory.service — salida (EXIT)', () => {
  test('stock insuficiente (decrementConditional → null) ⇒ 409 canónico', async () => {
    stockLevelRepository.decrementConditional.mockResolvedValue(null);
    stockLevelRepository.getOne.mockResolvedValue({ quantity: 2 });

    await expect(
      inventoryService.exit(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 10 },
        actor
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Stock insuficiente en el almacén indicado.',
      details: { available: 2 },
    });
    expect(inventoryMovementRepository.create).not.toHaveBeenCalled();
  });

  test('salida válida: delta negativo y saldos coherentes', async () => {
    stockLevelRepository.decrementConditional.mockResolvedValue({ quantity: 7 }); // 10 - 3
    inventoryMovementRepository.create.mockResolvedValue({ _id: 'm2', type: 'EXIT' });

    await inventoryService.exit(
      { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 3 },
      actor
    );

    expect(inventoryMovementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXIT', quantity: 3, delta: -3, quantityBefore: 10, quantityAfter: 7 })
    );
  });

  test('si el movimiento falla, se COMPENSA reponiendo el stock descontado', async () => {
    stockLevelRepository.decrementConditional.mockResolvedValue({ quantity: 7 });
    inventoryMovementRepository.create.mockRejectedValue(new Error('db down'));
    stockLevelRepository.increment.mockResolvedValue({ quantity: 10 });

    await expect(
      inventoryService.exit(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 3 },
        actor
      )
    ).rejects.toThrow('db down');

    expect(stockLevelRepository.increment).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      3
    );
  });
});

describe('inventory.service — ajuste (ADJUSTMENT)', () => {
  test('carrera (setExact → null) ⇒ 409 de reintento', async () => {
    stockLevelRepository.getOne.mockResolvedValue({ quantity: 10 });
    stockLevelRepository.setExact.mockResolvedValue(null);

    await expect(
      inventoryService.adjustment(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 12, reason: 'Recuento' },
        actor
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El stock cambió durante la operación. Intente de nuevo.',
    });
    expect(inventoryMovementRepository.create).not.toHaveBeenCalled();
  });

  test('ajuste válido: fija el recuento absoluto y registra el delta', async () => {
    stockLevelRepository.getOne.mockResolvedValue({ quantity: 10 });
    stockLevelRepository.setExact.mockResolvedValue({ quantity: 4 });
    inventoryMovementRepository.create.mockResolvedValue({ _id: 'm3', type: 'ADJUSTMENT' });

    const movement = await inventoryService.adjustment(
      { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 4, reason: 'Rotura' },
      actor
    );

    expect(movement._id).toBe('m3');
    expect(inventoryMovementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADJUSTMENT',
        quantity: 4,
        delta: -6,
        quantityBefore: 10,
        quantityAfter: 4,
        reason: 'Rotura',
      })
    );
    expect(stockLevelRepository.setExact).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      10,
      4
    );
  });

  test('sin fila y recuento > 0 crea la fila (11000 ⇒ carrera ⇒ 409)', async () => {
    stockLevelRepository.getOne.mockResolvedValue(null);
    stockLevelRepository.createIfAbsent.mockResolvedValue(null);

    await expect(
      inventoryService.adjustment(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 6, reason: 'Alta inicial' },
        actor
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('si el movimiento del ajuste falla, se restaura el valor anterior', async () => {
    stockLevelRepository.getOne.mockResolvedValue({ quantity: 10 });
    stockLevelRepository.setExact
      .mockResolvedValueOnce({ quantity: 4 }) // ajuste directo
      .mockResolvedValueOnce({ quantity: 10 }); // compensación
    inventoryMovementRepository.create.mockRejectedValue(new Error('db down'));

    await expect(
      inventoryService.adjustment(
        { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A, quantity: 4, reason: 'Rotura' },
        actor
      )
    ).rejects.toThrow('db down');

    expect(stockLevelRepository.setExact).toHaveBeenLastCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      4,
      10
    );
  });
});

describe('inventory.service — transferencia (TRANSFER)', () => {
  test('origen = destino ⇒ 422 con el campo señalado', async () => {
    await expect(
      inventoryService.transfer(
        {
          productId: PRODUCT_ID,
          fromWarehouseId: WAREHOUSE_A,
          toWarehouseId: WAREHOUSE_A,
          quantity: 1,
        },
        actor
      )
    ).rejects.toMatchObject({
      statusCode: 422,
      details: [{ field: 'toWarehouseId', message: 'Debe ser distinto del almacén de origen.' }],
    });
  });

  test('origen sin stock ⇒ 409 y NO se incrementa el destino', async () => {
    stockLevelRepository.decrementConditional.mockResolvedValue(null);
    stockLevelRepository.getOne.mockResolvedValue(null);

    await expect(
      inventoryService.transfer(
        {
          productId: PRODUCT_ID,
          fromWarehouseId: WAREHOUSE_A,
          toWarehouseId: WAREHOUSE_B,
          quantity: 5,
        },
        actor
      )
    ).rejects.toMatchObject({ statusCode: 409, message: 'Stock insuficiente en el almacén indicado.' });

    expect(stockLevelRepository.increment).not.toHaveBeenCalled();
    expect(inventoryMovementRepository.create).not.toHaveBeenCalled();
  });

  test('transferencia válida: descuenta origen, acredita destino y registra movimiento', async () => {
    stockLevelRepository.decrementConditional.mockResolvedValue({ quantity: 5 }); // 8 - 3
    stockLevelRepository.increment.mockResolvedValue({ quantity: 3 });
    inventoryMovementRepository.create.mockResolvedValue({ _id: 'm4', type: 'TRANSFER' });

    await inventoryService.transfer(
      {
        productId: PRODUCT_ID,
        fromWarehouseId: WAREHOUSE_A,
        toWarehouseId: WAREHOUSE_B,
        quantity: 3,
      },
      actor
    );

    expect(stockLevelRepository.decrementConditional).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      3
    );
    expect(stockLevelRepository.increment).toHaveBeenCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_B, productId: PRODUCT_ID },
      3
    );
    expect(inventoryMovementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TRANSFER',
        warehouseId: WAREHOUSE_A,
        toWarehouseId: WAREHOUSE_B,
        delta: -3,
        quantityBefore: 8,
        quantityAfter: 5,
      })
    );
  });

  test('si el movimiento falla: se revierte destino (−) y origen (+)', async () => {
    stockLevelRepository.decrementConditional.mockResolvedValue({ quantity: 5 });
    stockLevelRepository.increment.mockResolvedValue({ quantity: 3 });
    inventoryMovementRepository.create.mockRejectedValue(new Error('db down'));

    await expect(
      inventoryService.transfer(
        {
          productId: PRODUCT_ID,
          fromWarehouseId: WAREHOUSE_A,
          toWarehouseId: WAREHOUSE_B,
          quantity: 3,
        },
        actor
      )
    ).rejects.toThrow('db down');

    // 1ª llamada: acreditar destino; 2ª: compensar origen. Última: restaurar origen.
    expect(stockLevelRepository.increment).toHaveBeenNthCalledWith(
      1,
      { companyId: COMPANY, warehouseId: WAREHOUSE_B, productId: PRODUCT_ID },
      3
    );
    expect(stockLevelRepository.increment).toHaveBeenNthCalledWith(
      2,
      { companyId: COMPANY, warehouseId: WAREHOUSE_A, productId: PRODUCT_ID },
      3
    );
    expect(stockLevelRepository.decrementConditional).toHaveBeenLastCalledWith(
      { companyId: COMPANY, warehouseId: WAREHOUSE_B, productId: PRODUCT_ID },
      3
    );
  });
});
