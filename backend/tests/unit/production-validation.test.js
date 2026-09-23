'use strict';

/**
 * Validación Zod de FASE 6 (producción):
 * BOM con componentes y órdenes de producción con flujo DRAFT→RELEASED→
 * DONE|CANCELLED (ADR-013). Ningún módulo expone `.delete` (ADR-012).
 */

const bomSchemas = require('../../src/modules/production/bom.validation');
const orderSchemas = require('../../src/modules/production/production_order.validation');

const FIN = '64b000000000000000000401';
const C1 = '64b000000000000000000402';
const C2 = '64b000000000000000000403';
const BOM = '64b000000000000000000404';
const WH = '64b000000000000000000405';

describe('BOM — createSchema / updateSchema', () => {
  const COMPONENTS = [
    { productId: C1, quantity: 2 },
    { productId: C2, quantity: 0.5 },
  ];

  test('payload mínimo con un componente y payload completo', () => {
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: C1, quantity: 1 }] })
        .success
    ).toBe(true);

    const full = bomSchemas.createSchema.safeParse({
      productId: FIN,
      components: COMPONENTS,
      notes: 'Ensamble base',
      status: 'active',
    });
    expect(full.success).toBe(true);
    expect(full.data.components).toHaveLength(2);
  });

  test('componentes vacíos o cantidad <= 0 ⇒ inválido', () => {
    expect(bomSchemas.createSchema.safeParse({ productId: FIN, components: [] }).success).toBe(false);
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: C1, quantity: 0 }] })
        .success
    ).toBe(false);
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: C1, quantity: -2 }] })
        .success
    ).toBe(false);
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: 'no-oid', quantity: 1 }] })
        .success
    ).toBe(false);
  });

  test('producto terminado como componente o componente repetido ⇒ inválido', () => {
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: FIN, quantity: 1 }] })
        .success
    ).toBe(false);
    expect(
      bomSchemas.createSchema.safeParse({
        productId: FIN,
        components: [
          { productId: C1, quantity: 1 },
          { productId: C1, quantity: 3 },
        ],
      }).success
    ).toBe(false);
  });

  test('schema estricto: code/companyId/status del servidor inyectados ⇒ inválido', () => {
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: C1, quantity: 1 }], code: 'BOM-999999' })
        .success
    ).toBe(false);
    expect(
      bomSchemas.createSchema.safeParse({ productId: FIN, components: [{ productId: C1, quantity: 1 }], companyId: 'x' })
        .success
    ).toBe(false);
    expect(bomSchemas.CREATE_FIELDS).not.toContain('code');
    expect(bomSchemas.CREATE_FIELDS).not.toContain('companyId');
    expect(bomSchemas.CREATE_FIELDS).toContain('status'); // lifecycle por estado
  });

  test('PATCH parcial estricto; auto-referencia cruzada contra el productId del patch', () => {
    expect(bomSchemas.updateSchema.safeParse({ notes: 'Revisión' }).success).toBe(true);
    expect(bomSchemas.updateSchema.safeParse({ status: 'inactive' }).success).toBe(true);
    expect(bomSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(
      bomSchemas.updateSchema.safeParse({ productId: FIN, components: [{ productId: FIN, quantity: 1 }] })
        .success
    ).toBe(false);
    expect(
      bomSchemas.updateSchema.safeParse({ productId: FIN, components: [{ productId: C1, quantity: 1 }] })
        .success
    ).toBe(true);
    // Sin productId en el patch el cruce no es evaluable en Zod: lo valida el service.
    expect(
      bomSchemas.updateSchema.safeParse({ components: [{ productId: C1, quantity: 1 }] }).success
    ).toBe(true);
  });

  test('listQuery: status y producto; paginación coercida', () => {
    expect(bomSchemas.listQuery.safeParse({ status: 'active', productId: FIN, page: '2' }).success).toBe(true);
    expect(bomSchemas.listQuery.safeParse({ status: 'archived' }).success).toBe(false);
    expect(bomSchemas.listQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('Orden de producción — createSchema / flujo', () => {
  test('payload mínimo (warehouseId opcional) y payload completo', () => {
    const minimal = orderSchemas.createSchema.safeParse({ bomId: BOM, quantity: 10 });
    expect(minimal.success).toBe(true);

    const full = orderSchemas.createSchema.safeParse({
      bomId: BOM,
      warehouseId: WH,
      quantity: 2.5,
      notes: 'Lote de prueba',
    });
    expect(full.success).toBe(true);
    expect(full.data.quantity).toBe(2.5);
  });

  test('quantity <= 0, bomId inválido o inyecciones de servidor ⇒ inválido', () => {
    expect(orderSchemas.createSchema.safeParse({ bomId: BOM, quantity: 0 }).success).toBe(false);
    expect(orderSchemas.createSchema.safeParse({ bomId: BOM, quantity: -1 }).success).toBe(false);
    expect(orderSchemas.createSchema.safeParse({ bomId: 'no-oid', quantity: 1 }).success).toBe(false);
    expect(orderSchemas.createSchema.safeParse({ bomId: BOM, quantity: 1, warehouseId: 'x' }).success).toBe(false);
    expect(
      orderSchemas.createSchema.safeParse({ bomId: BOM, quantity: 1, status: 'RELEASED' }).success
    ).toBe(false);
    expect(
      orderSchemas.createSchema.safeParse({ bomId: BOM, quantity: 1, code: 'MO-999999' }).success
    ).toBe(false);
    expect(orderSchemas.CREATE_FIELDS).not.toContain('status');
    expect(orderSchemas.CREATE_FIELDS).not.toContain('code');
    expect(orderSchemas.CREATE_FIELDS).not.toContain('lines');
    expect(orderSchemas.CREATE_FIELDS).not.toContain('companyId');
  });

  test('PATCH parcial estricto no vacío', () => {
    expect(orderSchemas.updateSchema.safeParse({ quantity: 8 }).success).toBe(true);
    expect(orderSchemas.updateSchema.safeParse({ notes: 'x' }).success).toBe(true);
    expect(orderSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(orderSchemas.updateSchema.safeParse({ quantity: 8, status: 'DONE' }).success).toBe(false);
  });

  test('emptyBody (release/done): tolera el cuerpo ausente pero rechaza campos', () => {
    expect(orderSchemas.emptyBody.safeParse(undefined).success).toBe(true);
    expect(orderSchemas.emptyBody.safeParse({}).success).toBe(true);
    expect(orderSchemas.emptyBody.safeParse({ reason: 'x' }).success).toBe(false);
  });

  test('cancelSchema exige reason (>= 2); CANCEL_FIELDS = ["reason"]', () => {
    expect(orderSchemas.cancelSchema.safeParse({ reason: 'Falta de materia prima' }).success).toBe(true);
    expect(orderSchemas.cancelSchema.safeParse({}).success).toBe(false);
    expect(orderSchemas.cancelSchema.safeParse({ reason: 'x' }).success).toBe(false);
    expect(orderSchemas.cancelSchema.safeParse({ reason: 'ok', quantity: 5 }).success).toBe(false);
    expect(orderSchemas.CANCEL_FIELDS).toEqual(['reason']);
  });

  test('listQuery: status del flujo; status inválido ⇒ inválido', () => {
    expect(orderSchemas.listQuery.safeParse({ status: 'RELEASED', bomId: BOM }).success).toBe(true);
    expect(orderSchemas.listQuery.safeParse({ status: 'APPROVED' }).success).toBe(false);
    expect(orderSchemas.listQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});
