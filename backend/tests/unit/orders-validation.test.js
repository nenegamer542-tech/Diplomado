'use strict';

/**
 * Validación Zod de FASE 4 (compras/ventas):
 * proveedores, clientes y documentos con líneas.
 */

const purchaseSchemas = require('../../src/modules/purchase-orders/purchase_order.validation');
const salesSchemas = require('../../src/modules/sales-orders/sales_order.validation');
const supplierSchemas = require('../../src/modules/suppliers/supplier.validation');
const customerSchemas = require('../../src/modules/customers/customer.validation');

const SUPPLIER_ID = '64b000000000000000000101';
const CUSTOMER_ID = '64b000000000000000000102';
const PRODUCT_A = '64b000000000000000000010';
const PRODUCT_B = '64b000000000000000000011';

describe('Orden de compra — createSchema', () => {
  test('payload válido con dos líneas pasa', () => {
    const result = purchaseSchemas.createSchema.safeParse({
      supplierId: SUPPLIER_ID,
      lines: [
        { productId: PRODUCT_A, quantity: 5, unitCost: 10.5 },
        { productId: PRODUCT_B, quantity: 2, unitCost: 3 },
      ],
      notes: 'Pedido semanal',
    });
    expect(result.success).toBe(true);
  });

  test('sin líneas o con array vacío → inválido', () => {
    expect(
      purchaseSchemas.createSchema.safeParse({ supplierId: SUPPLIER_ID, lines: [] }).success
    ).toBe(false);
    expect(purchaseSchemas.createSchema.safeParse({ supplierId: SUPPLIER_ID }).success).toBe(false);
  });

  test('líneas estrictas: quantity 0/negativa, unitCost negativo o campo extra → inválido', () => {
    const base = { supplierId: SUPPLIER_ID };
    expect(
      purchaseSchemas.createSchema.safeParse({
        ...base,
        lines: [{ productId: PRODUCT_A, quantity: 0, unitCost: 1 }],
      }).success
    ).toBe(false);
    expect(
      purchaseSchemas.createSchema.safeParse({
        ...base,
        lines: [{ productId: PRODUCT_A, quantity: 1, unitCost: -1 }],
      }).success
    ).toBe(false);
    expect(
      purchaseSchemas.createSchema.safeParse({
        ...base,
        lines: [{ productId: PRODUCT_A, quantity: 1, unitCost: 1, companyId: 'x' }],
      }).success
    ).toBe(false);
  });

  test('warehouseId opcional pero debe ser ObjectId si viene', () => {
    expect(
      purchaseSchemas.createSchema.safeParse({
        supplierId: SUPPLIER_ID,
        warehouseId: 'no-es-id',
        lines: [{ productId: PRODUCT_A, quantity: 1, unitCost: 1 }],
      }).success
    ).toBe(false);
  });

  test('status/companyId/total NO están en CREATE_FIELDS (son de servidor)', () => {
    for (const fields of [purchaseSchemas.CREATE_FIELDS, salesSchemas.CREATE_FIELDS]) {
      expect(fields).not.toContain('status');
      expect(fields).not.toContain('companyId');
      expect(fields).not.toContain('total');
      expect(fields).not.toContain('code');
    }
    expect(purchaseSchemas.APPROVE_FIELDS).toEqual([]);
    expect(purchaseSchemas.REJECT_FIELDS).toEqual(['reason']);
  });
});

describe('Pedido de venta — createSchema', () => {
  test('líneas usan unitPrice (no unitCost) y campos extra se rechazan', () => {
    const ok = salesSchemas.createSchema.safeParse({
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_A, quantity: 3, unitPrice: 25.9 }],
    });
    expect(ok.success).toBe(true);

    const wrongField = salesSchemas.createSchema.safeParse({
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_A, quantity: 3, unitPrice: 25.9, unitCost: 10 }],
    });
    expect(wrongField.success).toBe(false);
  });
});

describe('Documentos — update/approve/reject/list', () => {
  test('update parcial no vacío', () => {
    expect(purchaseSchemas.updateSchema.safeParse({ notes: 'x' }).success).toBe(true);
    expect(purchaseSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(salesSchemas.updateSchema.safeParse({}).success).toBe(false);
  });

  test('approve sólo admite cuerpo {} (sin campos inyectados)', () => {
    expect(purchaseSchemas.approveSchema.safeParse({}).success).toBe(true);
    expect(purchaseSchemas.approveSchema.safeParse({ status: 'APPROVED' }).success).toBe(false);
    expect(salesSchemas.approveSchema.safeParse({ force: true }).success).toBe(false);
  });

  test('reject exige reason con al menos 2 caracteres', () => {
    expect(purchaseSchemas.rejectSchema.safeParse({}).success).toBe(false);
    expect(purchaseSchemas.rejectSchema.safeParse({ reason: 'a' }).success).toBe(false);
    expect(purchaseSchemas.rejectSchema.safeParse({ reason: 'Sin presupuesto' }).success).toBe(true);
    expect(salesSchemas.rejectSchema.safeParse({ reason: 'ok' }).success).toBe(true);
  });

  test('listQuery: status fuera del enum o supplierId inválido → inválido', () => {
    expect(purchaseSchemas.listQuery.safeParse({ status: 'CANCELLED' }).success).toBe(false);
    expect(purchaseSchemas.listQuery.safeParse({ status: 'DRAFT' }).success).toBe(true);
    expect(purchaseSchemas.listQuery.safeParse({ supplierId: 'x' }).success).toBe(false);
    expect(salesSchemas.listQuery.safeParse({ status: 'APPROVED' }).success).toBe(true);
    expect(salesSchemas.listQuery.safeParse({ customerId: 'x' }).success).toBe(false);
  });
});

describe('Proveedores y clientes', () => {
  test('supplier: código con formato inválido o nombre corto → inválido', () => {
    expect(supplierSchemas.createSchema.safeParse({ code: 'a b', name: 'ACME' }).success).toBe(false);
    expect(supplierSchemas.createSchema.safeParse({ code: 'PROV-1', name: 'A' }).success).toBe(false);
    expect(supplierSchemas.createSchema.safeParse({ code: 'PROV-1', name: 'ACME' }).success).toBe(true);
  });

  test('customer: schema estricto (companyId inyectado → inválido)', () => {
    expect(
      customerSchemas.createSchema.safeParse({
        code: 'CLI-1',
        name: 'Cliente',
        companyId: 'otra',
      }).success
    ).toBe(false);
  });

  test('updates parciales no vacíos', () => {
    expect(supplierSchemas.updateSchema.safeParse({ phone: '555' }).success).toBe(true);
    expect(supplierSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(customerSchemas.updateSchema.safeParse({}).success).toBe(false);
  });
});
