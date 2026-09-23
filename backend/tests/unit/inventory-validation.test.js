'use strict';

/**
 * Validación Zod del módulo de inventario (FASE 3).
 * Verifica cantidades, motivo obligatorio en ajustes, transferencia
 * origen≠destino, estricticidad de campos (anti inyección de companyId).
 */

const {
  ENTRY_EXIT_FIELDS,
  ADJUSTMENT_FIELDS,
  TRANSFER_FIELDS,
  entrySchema,
  exitSchema,
  adjustmentSchema,
  transferSchema,
  stockQuery,
  movementsQuery,
} = require('../../src/modules/inventory/inventory.validation');

const PRODUCT_ID = '64b000000000000000000010';
const WAREHOUSE_A = '64b000000000000000000020';
const WAREHOUSE_B = '64b000000000000000000021';

describe('Esquemas de movimientos (entrada/salida)', () => {
  test('payload válido de entrada pasa', () => {
    const result = entrySchema.safeParse({
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_A,
      quantity: 10,
      reason: 'Compra',
    });
    expect(result.success).toBe(true);
  });

  test('quantity = 0 o negativa se rechaza (> 0 obligatorio)', () => {
    const base = { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A };
    expect(entrySchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(exitSchema.safeParse({ ...base, quantity: -5 }).success).toBe(false);
  });

  test('quantity no numérica se rechaza', () => {
    const result = entrySchema.safeParse({
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_A,
      quantity: 'diez',
    });
    expect(result.success).toBe(false);
  });

  test('productId/warehouseId deben ser ObjectIds válidos', () => {
    const result = entrySchema.safeParse({
      productId: 'no-es-id',
      warehouseId: WAREHOUSE_A,
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  test('schema estricto: rechaza companyId u otros campos inyectados', () => {
    const result = entrySchema.safeParse({
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_A,
      quantity: 1,
      companyId: 'otra-empresa',
    });
    expect(result.success).toBe(false);
  });

  test('listas de campos permitidos no incluyen companyId', () => {
    for (const fields of [ENTRY_EXIT_FIELDS, ADJUSTMENT_FIELDS, TRANSFER_FIELDS]) {
      expect(fields).not.toContain('companyId');
      expect(fields).not.toContain('_id');
    }
  });
});

describe('Ajuste (recuento absoluto)', () => {
  const base = { productId: PRODUCT_ID, warehouseId: WAREHOUSE_A };

  test('reason es obligatorio y con al menos 2 caracteres', () => {
    expect(adjustmentSchema.safeParse({ ...base, quantity: 5 }).success).toBe(false);
    expect(adjustmentSchema.safeParse({ ...base, quantity: 5, reason: 'a' }).success).toBe(false);
    expect(
      adjustmentSchema.safeParse({ ...base, quantity: 5, reason: 'Recuento cíclico' }).success
    ).toBe(true);
  });

  test('quantity 0 (agotar) sí se permite; negativa no', () => {
    expect(adjustmentSchema.safeParse({ ...base, quantity: 0, reason: 'Cero' }).success).toBe(true);
    expect(adjustmentSchema.safeParse({ ...base, quantity: -1, reason: 'Cero' }).success).toBe(false);
  });
});

describe('Transferencia', () => {
  const base = { productId: PRODUCT_ID, quantity: 3 };

  test('origen y destino deben ser distintos', () => {
    const result = transferSchema.safeParse({
      ...base,
      fromWarehouseId: WAREHOUSE_A,
      toWarehouseId: WAREHOUSE_A,
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['toWarehouseId']);
  });

  test('transferencia a otro almacén válida', () => {
    const result = transferSchema.safeParse({
      ...base,
      fromWarehouseId: WAREHOUSE_A,
      toWarehouseId: WAREHOUSE_B,
    });
    expect(result.success).toBe(true);
  });
});

describe('Consultas de listado', () => {
  test('stockQuery: page/limit se coercen; filtros por almacén/producto', () => {
    const result = stockQuery.safeParse({ page: '2', limit: '50', warehouseId: WAREHOUSE_A });
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(2);
    expect(result.data.limit).toBe(50);
  });

  test('stockQuery rechaza warehouseId inválido', () => {
    expect(stockQuery.safeParse({ warehouseId: 'x' }).success).toBe(false);
  });

  test('movementsQuery: type fuera del enum se rechaza', () => {
    expect(movementsQuery.safeParse({ type: 'ENTRY' }).success).toBe(true);
    expect(movementsQuery.safeParse({ type: 'THEFT' }).success).toBe(false);
  });

  test('movementsQuery: fechas from/to se coercen a Date; basura se rechaza', () => {
    const ok = movementsQuery.safeParse({ from: '2026-01-01', to: '2026-02-01' });
    expect(ok.success).toBe(true);
    expect(ok.data.from).toBeInstanceOf(Date);

    expect(movementsQuery.safeParse({ from: 'no-fecha' }).success).toBe(false);
  });

  test('limit nunca supera 100 (consistente con paginación)', () => {
    expect(movementsQuery.safeParse({ limit: 500 }).success).toBe(false);
  });
});
