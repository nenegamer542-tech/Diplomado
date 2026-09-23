'use strict';

/**
 * Reglas de FASE 4 (ADR-010): documentos DRAFT → APPROVED | REJECTED con
 * asiento de inventario al aprobar y REVERSIÓN (compensación) si algo falla.
 * Sólo se crea/edita en borrador; IDs ajenos ⇒ 404; total calculado por el
 * servidor; código secuencial por empresa (contador atómico, ADR-009).
 */

jest.mock('../../src/config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../../src/common/sequence', () => ({
  ...jest.requireActual('../../src/common/sequence'),
  nextSequence: jest.fn(),
}));
jest.mock('../../src/modules/suppliers/supplier.repository', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
  find: jest.fn(),
  exists: jest.fn(),
}));
jest.mock('../../src/modules/customers/customer.repository', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
  find: jest.fn(),
  exists: jest.fn(),
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
jest.mock('../../src/modules/purchase-orders/purchase_order.repository', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../src/modules/sales-orders/sales_order.repository', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  find: jest.fn(),
}));

const { nextSequence, formatCode } = require('../../src/common/sequence');
const supplierRepository = require('../../src/modules/suppliers/supplier.repository');
const customerRepository = require('../../src/modules/customers/customer.repository');
const warehouseRepository = require('../../src/modules/warehouses/warehouse.repository');
const productRepository = require('../../src/modules/products/product.repository');
const inventoryService = require('../../src/modules/inventory/inventory.service');
const purchaseOrderRepository = require('../../src/modules/purchase-orders/purchase_order.repository');
const salesOrderRepository = require('../../src/modules/sales-orders/sales_order.repository');
const purchaseOrderService = require('../../src/modules/purchase-orders/purchase_order.service');
const salesOrderService = require('../../src/modules/sales-orders/sales_order.service');

const COMPANY = '64b000000000000000000001';
const SUPPLIER_ID = '64b000000000000000000101';
const CUSTOMER_ID = '64b000000000000000000102';
const PRODUCT_A = '64b000000000000000000010';
const PRODUCT_B = '64b000000000000000000011';
const WAREHOUSE_MAIN = '64b000000000000000000020';
const ORDER_ID = '64b000000000000000000201';
const USER_ID = '64b000000000000000000099';

const activeSupplier = { _id: SUPPLIER_ID, status: 'active' };
const activeCustomer = { _id: CUSTOMER_ID, status: 'active' };
const activeWarehouse = { _id: WAREHOUSE_MAIN, status: 'active' };
const activeProductA = { _id: PRODUCT_A, status: 'active' };
const activeProductB = { _id: PRODUCT_B, status: 'active' };

const draftOrder = (extra = {}) => ({
  _id: ORDER_ID,
  companyId: COMPANY,
  code: 'PO-000001',
  status: 'DRAFT',
  supplierId: SUPPLIER_ID,
  warehouseId: WAREHOUSE_MAIN,
  lines: [
    { productId: PRODUCT_A, quantity: 5, unitCost: 10 },
    { productId: PRODUCT_B, quantity: 2, unitCost: 3 },
  ],
  ...extra,
});

beforeEach(() => {
  jest.resetAllMocks();
  supplierRepository.findById.mockResolvedValue(activeSupplier);
  customerRepository.findById.mockResolvedValue(activeCustomer);
  warehouseRepository.findById.mockResolvedValue(activeWarehouse);
  warehouseRepository.findDefault.mockResolvedValue(activeWarehouse);
  productRepository.findById.mockImplementation(async (id) =>
    String(id) === PRODUCT_B ? activeProductB : activeProductA
  );
});

// ---------------------------------------------------------------------------
// Órdenes de compra
// ---------------------------------------------------------------------------
describe('purchase-order.service — creación', () => {
  const payload = {
    supplierId: SUPPLIER_ID,
    lines: [
      { productId: PRODUCT_A, quantity: 5, unitCost: 10.25 },
      { productId: PRODUCT_B, quantity: 2, unitCost: 3 },
    ],
  };

  test('crea el borrador con código secuencial, total calculado y estado DRAFT', async () => {
    nextSequence.mockResolvedValue(7);
    purchaseOrderRepository.create.mockImplementation((data) => Promise.resolve({ _id: 'o1', ...data }));

    const order = await purchaseOrderService.create(payload, COMPANY, USER_ID);

    expect(order.code).toBe(formatCode('PO', 7));
    expect(order.code).toBe('PO-000007');
    expect(order.status).toBe('DRAFT');
    expect(order.total).toBe(57.25); // 5×10.25 + 2×3
    expect(order.companyId).toBe(COMPANY);
    expect(order.createdBy).toBe(USER_ID);
    expect(order.warehouseId).toBe(WAREHOUSE_MAIN); // default resuelto
  });

  test('proveedor de OTRA empresa → 404 y no se consume numeración', async () => {
    supplierRepository.findById.mockResolvedValue(null);
    await expect(purchaseOrderService.create(payload, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
    expect(nextSequence).not.toHaveBeenCalled();
    expect(purchaseOrderRepository.create).not.toHaveBeenCalled();
  });

  test('proveedor inactivo → 409', async () => {
    supplierRepository.findById.mockResolvedValue({ _id: SUPPLIER_ID, status: 'inactive' });
    await expect(purchaseOrderService.create(payload, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El proveedor está inactivo; no admite órdenes de compra.',
    });
  });

  test('producto inactivo en una línea → 409 antes de crear nada', async () => {
    productRepository.findById.mockResolvedValue({ _id: PRODUCT_A, status: 'inactive' });
    await expect(purchaseOrderService.create(payload, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(purchaseOrderRepository.create).not.toHaveBeenCalled();
  });

  test('sin warehouseId y sin almacén predeterminado → 409', async () => {
    warehouseRepository.findDefault.mockResolvedValue(null);
    await expect(purchaseOrderService.create(payload, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'La empresa no tiene un almacén predeterminado.',
    });
  });
});

describe('purchase-order.service — edición sólo en borrador', () => {
  test('editar documento aprobado → 409', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder({ status: 'APPROVED' }));
    await expect(
      purchaseOrderService.update(ORDER_ID, { notes: 'x' }, COMPANY)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Sólo los documentos en borrador pueden modificarse.',
    });
    expect(purchaseOrderRepository.updateById).not.toHaveBeenCalled();
  });

  test('editar sólo notes en DRAFT no re-valida productos', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder());
    purchaseOrderRepository.updateById.mockResolvedValue(draftOrder({ notes: 'nueva' }));

    await purchaseOrderService.update(ORDER_ID, { notes: 'nueva' }, COMPANY);

    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(purchaseOrderRepository.updateById).toHaveBeenCalledWith(
      ORDER_ID,
      { notes: 'nueva' },
      { companyId: COMPANY }
    );
  });
});

describe('purchase-order.service — aprobar (entrada de inventario)', () => {
  test('aprueba: una ENTRADA por línea + estado APPROVED', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder());
    inventoryService.entry.mockResolvedValue({ _id: 'm1' });
    purchaseOrderRepository.updateById.mockResolvedValue(draftOrder({ status: 'APPROVED' }));

    const result = await purchaseOrderService.approve(ORDER_ID, COMPANY, USER_ID);

    expect(result.status).toBe('APPROVED');
    expect(inventoryService.entry).toHaveBeenCalledTimes(2);
    expect(inventoryService.entry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        productId: PRODUCT_A,
        warehouseId: WAREHOUSE_MAIN,
        quantity: 5,
        reference: 'PO-000001',
      }),
      { companyId: COMPANY, userId: USER_ID }
    );
    expect(purchaseOrderRepository.updateById).toHaveBeenCalledWith(
      ORDER_ID,
      expect.objectContaining({ status: 'APPROVED', approvedBy: USER_ID }),
      { companyId: COMPANY }
    );
  });

  test('línea 2 falla ⇒ se COMPENSA la línea 1 (salida) y NO se aprueba', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder());
    inventoryService.entry
      .mockResolvedValueOnce({ _id: 'm1' })
      .mockRejectedValueOnce(new Error('producto inactivo'));
    inventoryService.exit.mockResolvedValue({ _id: 'm2' });

    await expect(purchaseOrderService.approve(ORDER_ID, COMPANY, USER_ID)).rejects.toThrow(
      'producto inactivo'
    );

    expect(inventoryService.exit).toHaveBeenCalledWith(
      expect.objectContaining({ productId: PRODUCT_A, quantity: 5, reference: 'PO-000001' }),
      expect.any(Object)
    );
    expect(purchaseOrderRepository.updateById).not.toHaveBeenCalled();
  });

  test('doble aprobación → 409', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder({ status: 'APPROVED' }));
    await expect(purchaseOrderService.approve(ORDER_ID, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'La orden ya fue aprobada.',
    });
    expect(inventoryService.entry).not.toHaveBeenCalled();
  });

  test('aprobar una rechazada → 409', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder({ status: 'REJECTED' }));
    await expect(purchaseOrderService.approve(ORDER_ID, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'La orden fue rechazada; no puede aprobarse.',
    });
  });

  test('orden de otra empresa → 404', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(null);
    await expect(purchaseOrderService.approve(ORDER_ID, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('purchase-order.service — rechazar', () => {
  test('rechaza un borrador con motivo y sin tocar inventario', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder());
    purchaseOrderRepository.updateById.mockResolvedValue(draftOrder({ status: 'REJECTED' }));

    const result = await purchaseOrderService.reject(
      ORDER_ID,
      { reason: 'Sin presupuesto' },
      COMPANY,
      USER_ID
    );

    expect(result.status).toBe('REJECTED');
    expect(purchaseOrderRepository.updateById).toHaveBeenCalledWith(
      ORDER_ID,
      expect.objectContaining({
        status: 'REJECTED',
        rejectedBy: USER_ID,
        rejectionReason: 'Sin presupuesto',
      }),
      { companyId: COMPANY }
    );
    expect(inventoryService.entry).not.toHaveBeenCalled();
    expect(inventoryService.exit).not.toHaveBeenCalled();
  });

  test('rechazar una aprobada → 409', async () => {
    purchaseOrderRepository.findById.mockResolvedValue(draftOrder({ status: 'APPROVED' }));
    await expect(
      purchaseOrderService.reject(ORDER_ID, { reason: 'x' }, COMPANY, USER_ID)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'La orden aprobada no puede rechazarse.',
    });
  });
});

// ---------------------------------------------------------------------------
// Pedidos de venta
// ---------------------------------------------------------------------------
const salesDraft = (extra = {}) => ({
  _id: '64b000000000000000000202',
  companyId: COMPANY,
  code: 'SO-000001',
  status: 'DRAFT',
  customerId: CUSTOMER_ID,
  warehouseId: WAREHOUSE_MAIN,
  lines: [
    { productId: PRODUCT_A, quantity: 4, unitPrice: 15 },
    { productId: PRODUCT_B, quantity: 1, unitPrice: 30 },
  ],
  ...extra,
});

const SALES_ID = '64b000000000000000000202';

describe('sales-order.service — creación y aprobación', () => {
  test('crea el borrador con código SO y total calculado desde unitPrice', async () => {
    nextSequence.mockResolvedValue(1);
    salesOrderRepository.create.mockImplementation((data) => Promise.resolve({ _id: 's1', ...data }));

    const order = await salesOrderService.create(
      {
        customerId: CUSTOMER_ID,
        lines: [{ productId: PRODUCT_A, quantity: 4, unitPrice: 15.5 }],
      },
      COMPANY,
      USER_ID
    );

    expect(order.code).toBe('SO-000001');
    expect(order.total).toBe(62);
    expect(order.status).toBe('DRAFT');
  });

  test('cliente ajeno → 404', async () => {
    customerRepository.findById.mockResolvedValue(null);
    await expect(
      salesOrderService.create(
        { customerId: CUSTOMER_ID, lines: [{ productId: PRODUCT_A, quantity: 1, unitPrice: 1 }] },
        COMPANY,
        USER_ID
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('aprueba: una SALIDA por línea + estado APPROVED', async () => {
    salesOrderRepository.findById.mockResolvedValue(salesDraft());
    inventoryService.exit.mockResolvedValue({ _id: 'm1' });
    salesOrderRepository.updateById.mockResolvedValue(salesDraft({ status: 'APPROVED' }));

    const result = await salesOrderService.approve(SALES_ID, COMPANY, USER_ID);

    expect(result.status).toBe('APPROVED');
    expect(inventoryService.exit).toHaveBeenCalledTimes(2);
    expect(inventoryService.exit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        productId: PRODUCT_A,
        quantity: 4,
        warehouseId: WAREHOUSE_MAIN,
        reference: 'SO-000001',
      }),
      { companyId: COMPANY, userId: USER_ID }
    );
  });

  test('stock insuficiente en línea 2 ⇒ 409 canónico, REVERSIÓN de la línea 1 y sin aprobación', async () => {
    salesOrderRepository.findById.mockResolvedValue(salesDraft());
    inventoryService.exit
      .mockResolvedValueOnce({ _id: 'm1' })
      .mockRejectedValueOnce(
        Object.assign(new Error('Stock insuficiente en el almacén indicado.'), {
          statusCode: 409,
          code: 'CONFLICT',
        })
      );
    inventoryService.entry.mockResolvedValue({ _id: 'm2' });

    await expect(salesOrderService.approve(SALES_ID, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Stock insuficiente en el almacén indicado.',
    });

    expect(inventoryService.entry).toHaveBeenCalledWith(
      expect.objectContaining({ productId: PRODUCT_A, quantity: 4, reference: 'SO-000001' }),
      expect.any(Object)
    );
    expect(salesOrderRepository.updateById).not.toHaveBeenCalled();
  });

  test('pedido ya aprobado → 409; editado fuera de DRAFT → 409', async () => {
    salesOrderRepository.findById.mockResolvedValue(salesDraft({ status: 'APPROVED' }));
    await expect(salesOrderService.approve(SALES_ID, COMPANY, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'El pedido ya fue aprobado.',
    });

    await expect(
      salesOrderService.update(SALES_ID, { notes: 'x' }, COMPANY)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Sólo los documentos en borrador pueden modificarse.',
    });
  });

  test('rechazar pedido aprobado → 409', async () => {
    salesOrderRepository.findById.mockResolvedValue(salesDraft({ status: 'APPROVED' }));
    await expect(
      salesOrderService.reject(SALES_ID, { reason: 'x' }, COMPANY, USER_ID)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El pedido aprobado no puede rechazarse.',
    });
  });
});
