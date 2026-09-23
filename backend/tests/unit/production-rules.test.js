'use strict';

/**
 * Reglas de FASE 6 (ADR-013): órdenes de producción con flujo
 * DRAFT → RELEASED → DONE | CANCELLED y asientos de inventario compensados
 * (ADR-008); BOM con ciclo de vida active|inactive. Sin DELETE (ADR-012).
 * Multiempresa: ID ajeno ⇒ 404 (nunca 403).
 */

jest.mock('../../src/config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../src/common/sequence', () => ({
  ...jest.requireActual('../../src/common/sequence'),
  nextSequence: jest.fn(),
}));
jest.mock('../../src/modules/production/production_order.repository', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  find: jest.fn(),
  findByCode: jest.fn(),
  markReleased: jest.fn(),
  markDone: jest.fn(),
  markCancelled: jest.fn(),
}));
jest.mock('../../src/modules/production/bom.repository', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  find: jest.fn(),
  findByCode: jest.fn(),
}));
jest.mock('../../src/modules/warehouses/warehouse.repository', () => ({
  findById: jest.fn(),
  findDefault: jest.fn(),
}));
jest.mock('../../src/modules/products/product.repository', () => ({ findById: jest.fn() }));
jest.mock('../../src/modules/inventory/inventory.service', () => ({
  entry: jest.fn(),
  exit: jest.fn(),
}));

const { nextSequence } = require('../../src/common/sequence');
const productionOrderRepository = require('../../src/modules/production/production_order.repository');
const bomRepository = require('../../src/modules/production/bom.repository');
const warehouseRepository = require('../../src/modules/warehouses/warehouse.repository');
const productRepository = require('../../src/modules/products/product.repository');
const inventoryService = require('../../src/modules/inventory/inventory.service');
const bomService = require('../../src/modules/production/bom.service');
const productionOrderService = require('../../src/modules/production/production_order.service');

const COMPANY = '64b00000000000000000000a';
const FIN = '64b000000000000000000401';
const C1 = '64b000000000000000000402';
const C2 = '64b000000000000000000403';
const BOM = '64b000000000000000000404';
const WH = '64b000000000000000000405';

const activeProduct = (id) => ({ _id: id, companyId: COMPANY, status: 'active' });
const activeBom = (extra = {}) => ({
  _id: BOM,
  companyId: COMPANY,
  status: 'active',
  productId: FIN,
  components: [
    { productId: C1, quantity: 2 },
    { productId: C2, quantity: 3 },
  ],
  ...extra,
});
const draftOrder = (extra = {}) => ({
  _id: 'mo1',
  companyId: COMPANY,
  code: 'MO-000001',
  bomId: BOM,
  productId: FIN,
  warehouseId: WH,
  quantity: 4,
  status: 'DRAFT',
  lines: [],
  ...extra,
});
const actor = (userId = 'u1') => ({ companyId: COMPANY, userId });

beforeEach(() => {
  jest.resetAllMocks();
});

// ------------------------------------------------------------ BOM ---

describe('bomService — validación y ciclo de vida', () => {
  test('create: valida productos, consume numeración y crea BOM-000005', async () => {
    productRepository.findById.mockImplementation(async (id) => activeProduct(id));
    nextSequence.mockResolvedValue(5);
    bomRepository.create.mockResolvedValue({ _id: 'b1', code: 'BOM-000005' });

    const result = await bomService.create(
      { productId: FIN, components: [{ productId: C1, quantity: 2 }] },
      COMPANY,
      'u1'
    );

    expect(nextSequence).toHaveBeenCalledWith(COMPANY, 'boms');
    expect(bomRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        code: 'BOM-000005',
        productId: FIN,
        components: [{ productId: C1, quantity: 2 }],
        status: 'active',
        createdBy: 'u1',
      })
    );
    expect(result.code).toBe('BOM-000005');
  });

  test('create: producto final inexistente ⇒ 404 sin consumir numeración', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      bomService.create({ productId: FIN, components: [{ productId: C1, quantity: 1 }] }, COMPANY, null)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Recurso no encontrado.' });
    expect(nextSequence).not.toHaveBeenCalled();
    expect(bomRepository.create).not.toHaveBeenCalled();
  });

  test('create: componente inactivo ⇒ 409 sin consumir numeración', async () => {
    productRepository.findById.mockImplementation(async (id) =>
      id === C2 ? { _id: id, status: 'inactive' } : activeProduct(id)
    );

    await expect(
      bomService.create(
        {
          productId: FIN,
          components: [
            { productId: C1, quantity: 1 },
            { productId: C2, quantity: 1 },
          ],
        },
        COMPANY,
        null
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El producto está inactivo; no admite movimientos de inventario.',
    });
    expect(nextSequence).not.toHaveBeenCalled();
    expect(bomRepository.create).not.toHaveBeenCalled();
  });

  test('create: autoreferencia o componente repetido ⇒ 422 (defensa en profundidad)', async () => {
    productRepository.findById.mockImplementation(async (id) => activeProduct(id));

    await expect(
      bomService.create({ productId: FIN, components: [{ productId: FIN, quantity: 1 }] }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 422,
      message: 'El componente debe ser distinto del producto terminado.',
    });

    await expect(
      bomService.create(
        {
          productId: FIN,
          components: [
            { productId: C1, quantity: 1 },
            { productId: C1, quantity: 2 },
          ],
        },
        COMPANY,
        null
      )
    ).rejects.toMatchObject({ statusCode: 422, message: 'La lista contiene componentes repetidos.' });
    expect(bomRepository.create).not.toHaveBeenCalled();
  });

  test('update: sólo status no revalida productos (lifecycle directo)', async () => {
    bomRepository.findById.mockResolvedValue(
      activeBom({ components: [{ productId: C1, quantity: 1 }] })
    );
    bomRepository.updateById.mockResolvedValue({ _id: BOM, status: 'inactive' });

    await bomService.update(BOM, { status: 'inactive' }, COMPANY);

    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(bomRepository.updateById).toHaveBeenCalledWith(
      BOM,
      { status: 'inactive' },
      { companyId: COMPANY }
    );
  });

  test('update: los componentes nuevos se cruzan con el producto FINAL (merge)', async () => {
    // El producto almacenado es C1; el patch sólo trae components.
    bomRepository.findById.mockResolvedValue({
      _id: BOM,
      companyId: COMPANY,
      productId: C1,
      components: [{ productId: C2, quantity: 1 }],
      status: 'active',
    });
    productRepository.findById.mockImplementation(async (id) => activeProduct(id));

    await expect(
      bomService.update(BOM, { components: [{ productId: C1, quantity: 1 }] }, COMPANY)
    ).rejects.toMatchObject({
      statusCode: 422,
      message: 'El componente debe ser distinto del producto terminado.',
    });
    expect(bomRepository.updateById).not.toHaveBeenCalled();
  });

  test('update de BOM ajena ⇒ 404', async () => {
    bomRepository.findById.mockResolvedValue(null);
    await expect(bomService.update(BOM, { notes: 'x' }, COMPANY)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
  });
});

// --------------------------------------------------- orden de producción ---

describe('productionOrderService.create/update — guardas', () => {
  test('create: usa el almacén predeterminado si falta y crea MO-000001 en DRAFT', async () => {
    bomRepository.findById.mockResolvedValue(activeBom());
    warehouseRepository.findDefault.mockResolvedValue({ _id: WH, status: 'active' });
    productRepository.findById.mockResolvedValue(activeProduct(FIN));
    nextSequence.mockResolvedValue(1);
    productionOrderRepository.create.mockResolvedValue({ _id: 'mo1', code: 'MO-000001' });

    const result = await productionOrderService.create({ bomId: BOM, quantity: 4 }, COMPANY, 'u1');

    expect(warehouseRepository.findDefault).toHaveBeenCalledWith(COMPANY);
    expect(nextSequence).toHaveBeenCalledWith(COMPANY, 'production_orders');
    expect(productionOrderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        code: 'MO-000001',
        status: 'DRAFT',
        quantity: 4,
        lines: [],
        bomId: BOM,
        warehouseId: WH,
        productId: FIN,
        createdBy: 'u1',
      })
    );
    expect(result.code).toBe('MO-000001');
  });

  test('create: BOM ajena ⇒ 404 sin consumir numeración', async () => {
    bomRepository.findById.mockResolvedValue(null);

    await expect(
      productionOrderService.create({ bomId: BOM, quantity: 2 }, COMPANY, null)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Recurso no encontrado.' });
    expect(nextSequence).not.toHaveBeenCalled();
    expect(productionOrderRepository.create).not.toHaveBeenCalled();
  });

  test('create: BOM inactiva ⇒ 409 sin consumir numeración', async () => {
    bomRepository.findById.mockResolvedValue(activeBom({ status: 'inactive' }));

    await expect(
      productionOrderService.create({ bomId: BOM, quantity: 2 }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'La lista de materiales está inactiva; no admite órdenes de producción.',
    });
    expect(nextSequence).not.toHaveBeenCalled();
  });

  test('create: empresa sin almacén predeterminado (y sin warehouseId) ⇒ 409', async () => {
    bomRepository.findById.mockResolvedValue(activeBom());
    warehouseRepository.findDefault.mockResolvedValue(null);

    await expect(
      productionOrderService.create({ bomId: BOM, quantity: 2 }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'La empresa no tiene un almacén predeterminado.',
    });
    expect(nextSequence).not.toHaveBeenCalled();
  });

  test('create: almacén inactivo ⇒ 409', async () => {
    bomRepository.findById.mockResolvedValue(activeBom());
    warehouseRepository.findDefault.mockResolvedValue({ _id: WH, status: 'inactive' });

    await expect(
      productionOrderService.create({ bomId: BOM, quantity: 2 }, COMPANY, null)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El almacén está inactivo; no admite movimientos de inventario.',
    });
  });

  test('update sólo en DRAFT; fuera de borrador ⇒ 409 sin escribir', async () => {
    productionOrderRepository.findById.mockResolvedValue(draftOrder({ status: 'RELEASED' }));

    await expect(
      productionOrderService.update('mo1', { quantity: 5 }, COMPANY)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Sólo los documentos en borrador pueden modificarse.',
    });
    expect(productionOrderRepository.updateById).not.toHaveBeenCalled();
  });
});

describe('productionOrderService.release — salidas compensables (ADR-008)', () => {
  function primeRelease() {
    productionOrderRepository.findById.mockResolvedValue(draftOrder());
    bomRepository.findById.mockResolvedValue(activeBom());
    warehouseRepository.findById.mockResolvedValue({ _id: WH, status: 'active' });
    productRepository.findById.mockResolvedValue(activeProduct(FIN));
    inventoryService.exit.mockResolvedValue({});
    productionOrderRepository.markReleased.mockResolvedValue(
      draftOrder({ status: 'RELEASED', lines: [
        { productId: C1, quantity: 8 },
        { productId: C2, quantity: 12 },
      ] })
    );
  }

  test('salidas escaladas por quantity y snapshot de lines en el marcado', async () => {
    primeRelease();

    const result = await productionOrderService.release('mo1', COMPANY, 'u1');

    expect(inventoryService.exit).toHaveBeenCalledTimes(2);
    expect(inventoryService.exit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        productId: C1,
        warehouseId: WH,
        quantity: 8,
        reason: expect.stringContaining('Liberación'),
        reference: 'MO-000001',
      }),
      actor()
    );
    expect(inventoryService.exit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ productId: C2, quantity: 12 }),
      actor()
    );
    expect(productionOrderRepository.markReleased).toHaveBeenCalledWith(
      'mo1',
      { companyId: COMPANY },
      expect.objectContaining({
        status: 'RELEASED',
        lines: [
          { productId: C1, quantity: 8 },
          { productId: C2, quantity: 12 },
        ],
        releasedBy: 'u1',
      })
    );
    expect(result.status).toBe('RELEASED');
  });

  test('redondea el escalado a 4 decimales (0.25 × 3 = 0.75)', async () => {
    productionOrderRepository.findById.mockResolvedValue(draftOrder({ quantity: 3 }));
    bomRepository.findById.mockResolvedValue(
      activeBom({ components: [{ productId: C1, quantity: 0.25 }] })
    );
    warehouseRepository.findById.mockResolvedValue({ _id: WH, status: 'active' });
    productRepository.findById.mockResolvedValue(activeProduct(FIN));
    inventoryService.exit.mockResolvedValue({});
    productionOrderRepository.markReleased.mockResolvedValue({ _id: 'mo1', status: 'RELEASED' });

    await productionOrderService.release('mo1', COMPANY, null);

    expect(inventoryService.exit).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 0.75 }),
      expect.any(Object)
    );
  });

  test('estados bloqueados: RELEASED/DONE/CANCELLED ⇒ 409 sin tocar inventario', async () => {
    const cases = [
      ['RELEASED', 'La orden ya fue liberada.'],
      ['DONE', 'La orden ya fue finalizada; no puede liberarse.'],
      ['CANCELLED', 'La orden fue cancelada; no puede liberarse.'],
    ];
    for (const [status, message] of cases) {
      productionOrderRepository.findById.mockResolvedValue(draftOrder({ status }));
      await expect(productionOrderService.release('mo1', COMPANY, null)).rejects.toMatchObject({
        statusCode: 409,
        message,
      });
    }
    expect(inventoryService.exit).not.toHaveBeenCalled();
    expect(productionOrderRepository.markReleased).not.toHaveBeenCalled();
  });

  test('stock insuficiente en la 2ª línea ⇒ devuelve la 1ª y NO cambia estado', async () => {
    primeRelease();
    inventoryService.exit
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 409, message: 'Stock insuficiente en el almacén indicado.' });
    inventoryService.entry.mockResolvedValue({});

    await expect(productionOrderService.release('mo1', COMPANY, 'u1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Stock insuficiente en el almacén indicado.',
    });

    expect(inventoryService.entry).toHaveBeenCalledTimes(1);
    expect(inventoryService.entry).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: C1,
        quantity: 8,
        reason: expect.stringContaining('Compensación'),
      }),
      actor()
    );
    expect(productionOrderRepository.markReleased).not.toHaveBeenCalled();
  });

  test('carrera (markReleased null) ⇒ devuelve TODO el material y 409', async () => {
    primeRelease();
    productionOrderRepository.markReleased.mockResolvedValue(null);
    inventoryService.entry.mockResolvedValue({});

    await expect(productionOrderService.release('mo1', COMPANY, 'u1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'La orden cambió de estado durante la operación. Intente de nuevo.',
    });
    expect(inventoryService.entry).toHaveBeenCalledTimes(2);
  });
});

describe('productionOrderService.done — entrada del producto terminado', () => {
  const releasedOrder = () =>
    draftOrder({
      status: 'RELEASED',
      lines: [
        { productId: C1, quantity: 8 },
        { productId: C2, quantity: 12 },
      ],
    });

  test('entrada del producto terminado y marcado condicional DONE', async () => {
    productionOrderRepository.findById.mockResolvedValue(releasedOrder());
    inventoryService.entry.mockResolvedValue({});
    productionOrderRepository.markDone.mockResolvedValue({ _id: 'mo1', status: 'DONE' });

    const result = await productionOrderService.done('mo1', COMPANY, 'u1');

    expect(inventoryService.entry).toHaveBeenCalledWith(
      { productId: FIN, warehouseId: WH, quantity: 4, reason: expect.stringContaining('Finalización'), reference: 'MO-000001' },
      actor()
    );
    expect(productionOrderRepository.markDone).toHaveBeenCalledWith(
      'mo1',
      { companyId: COMPANY },
      expect.objectContaining({ status: 'DONE', doneBy: 'u1' })
    );
    expect(result.status).toBe('DONE');
  });

  test('estados bloqueados: DRAFT/DONE/CANCELLED ⇒ 409 sin asientos', async () => {
    const cases = [
      ['DRAFT', 'La orden debe estar liberada antes de finalizarse.'],
      ['DONE', 'La orden ya fue finalizada.'],
      ['CANCELLED', 'La orden fue cancelada; no puede finalizarse.'],
    ];
    for (const [status, message] of cases) {
      productionOrderRepository.findById.mockResolvedValue(draftOrder({ status }));
      await expect(productionOrderService.done('mo1', COMPANY, null)).rejects.toMatchObject({
        statusCode: 409,
        message,
      });
    }
    expect(inventoryService.entry).not.toHaveBeenCalled();
    expect(productionOrderRepository.markDone).not.toHaveBeenCalled();
  });

  test('si la entrada falla (producto inactivo) NO cambia el estado', async () => {
    productionOrderRepository.findById.mockResolvedValue(releasedOrder());
    inventoryService.entry.mockRejectedValue({
      statusCode: 409,
      message: 'El producto está inactivo; no admite movimientos de inventario.',
    });

    await expect(productionOrderService.done('mo1', COMPANY, 'u1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'El producto está inactivo; no admite movimientos de inventario.',
    });
    expect(productionOrderRepository.markDone).not.toHaveBeenCalled();
    expect(inventoryService.exit).not.toHaveBeenCalled(); // nada que compensar
  });

  test('carrera (markDone null) ⇒ extrae de vuelta el producto y 409', async () => {
    productionOrderRepository.findById.mockResolvedValue(releasedOrder());
    inventoryService.entry.mockResolvedValue({});
    productionOrderRepository.markDone.mockResolvedValue(null);
    inventoryService.exit.mockResolvedValue({});

    await expect(productionOrderService.done('mo1', COMPANY, 'u1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'La orden cambió de estado durante la operación. Intente de nuevo.',
    });
    expect(inventoryService.exit).toHaveBeenCalledWith(
      expect.objectContaining({ productId: FIN, quantity: 4, reason: expect.stringContaining('Compensación') }),
      actor()
    );
  });
});

describe('productionOrderService.cancel — devolución de material y carreras', () => {
  const releasedOrder = () =>
    draftOrder({
      status: 'RELEASED',
      lines: [
        { productId: C1, quantity: 8 },
        { productId: C2, quantity: 12 },
      ],
    });

  test('desde DRAFT sólo cambia el estado (sin inventario)', async () => {
    productionOrderRepository.findById.mockResolvedValue(draftOrder());
    productionOrderRepository.markCancelled.mockResolvedValue({
      _id: 'mo1',
      status: 'CANCELLED',
    });

    await productionOrderService.cancel('mo1', { reason: 'Sin materia prima' }, COMPANY, 'u1');

    expect(inventoryService.entry).not.toHaveBeenCalled();
    expect(inventoryService.exit).not.toHaveBeenCalled();
    expect(productionOrderRepository.markCancelled).toHaveBeenCalledWith(
      'mo1',
      { companyId: COMPANY },
      expect.objectContaining({
        status: 'CANCELLED',
        cancelReason: 'Sin materia prima',
        cancelledBy: 'u1',
      })
    );
  });

  test('desde RELEASED devuelve los componentes ANTES de marcar', async () => {
    productionOrderRepository.findById.mockResolvedValue(releasedOrder());
    inventoryService.entry.mockResolvedValue({});
    productionOrderRepository.markCancelled.mockResolvedValue({
      _id: 'mo1',
      status: 'CANCELLED',
    });

    await productionOrderService.cancel('mo1', { reason: 'Falla de producción' }, COMPANY, 'u1');

    expect(inventoryService.entry).toHaveBeenCalledTimes(2);
    expect(inventoryService.entry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ productId: C1, quantity: 8, reason: expect.stringContaining('Cancelación') }),
      actor()
    );
    expect(inventoryService.entry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ productId: C2, quantity: 12 }),
      actor()
    );
    expect(productionOrderRepository.markCancelled).toHaveBeenCalled();
  });

  test('estados bloqueados: DONE/CANCELLED ⇒ 409 sin marcar', async () => {
    const cases = [
      ['DONE', 'La orden finalizada no puede cancelarse.'],
      ['CANCELLED', 'La orden ya fue cancelada.'],
    ];
    for (const [status, message] of cases) {
      productionOrderRepository.findById.mockResolvedValue(draftOrder({ status }));
      await expect(
        productionOrderService.cancel('mo1', { reason: 'x' }, COMPANY, null)
      ).rejects.toMatchObject({ statusCode: 409, message });
    }
    expect(productionOrderRepository.markCancelled).not.toHaveBeenCalled();
  });

  test('RELEASED con fallo al devolver ⇒ reextrae lo devuelto y NO cancela', async () => {
    productionOrderRepository.findById.mockResolvedValue(releasedOrder());
    inventoryService.entry
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 409, message: 'El producto está inactivo; no admite movimientos de inventario.' });
    inventoryService.exit.mockResolvedValue({});

    await expect(
      productionOrderService.cancel('mo1', { reason: 'x' }, COMPANY, 'u1')
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El producto está inactivo; no admite movimientos de inventario.',
    });
    expect(inventoryService.exit).toHaveBeenCalledTimes(1);
    expect(inventoryService.exit).toHaveBeenCalledWith(
      expect.objectContaining({ productId: C1, quantity: 8 }),
      actor()
    );
    expect(productionOrderRepository.markCancelled).not.toHaveBeenCalled();
  });

  test('carrera (markCancelled null) ⇒ reextrae TODO el material y 409', async () => {
    productionOrderRepository.findById.mockResolvedValue(releasedOrder());
    inventoryService.entry.mockResolvedValue({});
    productionOrderRepository.markCancelled.mockResolvedValue(null);
    inventoryService.exit.mockResolvedValue({});

    await expect(
      productionOrderService.cancel('mo1', { reason: 'x' }, COMPANY, 'u1')
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'La orden cambió de estado durante la operación. Intente de nuevo.',
    });
    expect(inventoryService.entry).toHaveBeenCalledTimes(2);
    expect(inventoryService.exit).toHaveBeenCalledTimes(2);
  });

  test('orden inexistente/ajena ⇒ 404', async () => {
    productionOrderRepository.findById.mockResolvedValue(null);
    await expect(
      productionOrderService.cancel('mo1', { reason: 'x' }, COMPANY, null)
    ).rejects.toMatchObject({ statusCode: 404, message: 'Recurso no encontrado.' });
  });
});
