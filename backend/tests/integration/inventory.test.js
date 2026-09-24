'use strict';

/**
 * FASE 3 — Inventario (API + integración).
 *
 * Cubre: productos, almacenes y movimientos con las reglas del PROMPT:
 *  - RBAC por endpoint (lectores, almacen como operador, admin como gestor).
 *  - Multiempresa estricto: ID ajeno ⇒ 404 (nunca 403); listados aislados.
 *  - Stock: 409 canónico por stock insuficiente; ajuste con motivo obligatorio;
 *    transferencia origen≠destino; movimientos inmutables (sin PATCH/DELETE).
 *  - Guardas de borrado: producto/almacén/sucursal con existencias o historial.
 *  - Auditoría de los movimientos con resourceId.
 */

const request = require('supertest');
const { describeIfDb, connectTestDb, closeTestDb, app } = require('../helpers/setup');
const { createTenant, createUser, login, auth } = require('../helpers/fixtures');

/** Espera (con reintentos) a que la auditoría no bloqueante se asiente. */
async function waitFor(check, { timeoutMs = 2000, stepMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

describeIfDb('API /products, /warehouses e /inventory (integración FASE 3)', () => {
  let tenantA;
  let tenantB;
  let adminAToken;
  let consultaToken;
  let almacenToken;
  let adminBToken;

  let productId;
  let productNoHistoryId;
  let productMovId;
  let warehouseMainId;
  let warehouseSucId;
  let warehouseNorthId;
  let branchNorthId;
  let lastMovementId;

  beforeAll(async () => {
    await connectTestDb();

    tenantA = await createTenant({ name: 'Inventario A' });
    tenantB = await createTenant({ name: 'Inventario B' });

    const adminA = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.administrador,
      email: 'admin@inva.local',
    });
    const consulta = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.consulta,
      email: 'consulta@inva.local',
    });
    const almacen = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.almacen,
      email: 'almacen@inva.local',
    });
    const adminB = await createUser({
      company: tenantB.company,
      branch: tenantB.branch,
      role: tenantB.roles.administrador,
      email: 'admin@invb.local',
    });

    adminAToken = await login(adminA.email, 'Clave1234');
    consultaToken = await login(consulta.email, 'Clave1234');
    almacenToken = await login(almacen.email, 'Clave1234');
    adminBToken = await login(adminB.email, 'Clave1234');

    warehouseMainId = String(tenantA.warehouse._id);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // -------------------------------------------------------------------------
  // Productos
  // -------------------------------------------------------------------------
  test('POST /products sin token → 401', async () => {
    const res = await request(app).post('/api/v1/products').send({ sku: 'X1', name: 'X' });
    expect(res.status).toBe(401);
  });

  test('rol consulta NO puede crear productos → 403 con mensaje canónico', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth(consultaToken))
      .send({ sku: 'SKU-C1', name: 'Consultado' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: products.create.'
    );
  });

  test('admin crea producto → 201 y SKU en mayúsculas', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'sku-001', name: 'Producto Uno', unit: 'pza', taxRate: 16 });

    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe('SKU-001');
    expect(String(res.body.data.companyId)).toBe(String(tenantA.company._id));
    productId = res.body.data._id;
  });

  test('SKU duplicado en la misma empresa → 409 con mensaje canónico', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'SKU-001', name: 'Otro Nombre' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya existe un registro con ese valor en: sku.');
  });

  test('inyectar companyId en el body → 400 (campos no permitidos)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'SKU-002', name: 'Inyección', companyId: String(tenantB.company._id) });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Campos no permitidos: companyId.');
  });

  test('listado de productos aislado por empresa', async () => {
    const res = await request(app).get('/api/v1/products').set(auth(adminAToken));
    expect(res.status).toBe(200);
    const skus = res.body.data.map((p) => p.sku);
    expect(skus).toContain('SKU-001');

    const other = await request(app).get('/api/v1/products').set(auth(adminBToken));
    expect(other.status).toBe(200);
    expect(other.body.data).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Almacenes
  // -------------------------------------------------------------------------
  test('GET /warehouses incluye el almacén MAIN aprovisionado', async () => {
    const res = await request(app).get('/api/v1/warehouses').set(auth(consultaToken));
    expect(res.status).toBe(200);
    const main = res.body.data.find((w) => w.code === 'MAIN');
    expect(main).toBeDefined();
    expect(main.isDefault).toBe(true);
    expect(String(main.branchId)).toBe(String(tenantA.branch._id));
  });

  test('admin crea un segundo almacén vinculado a sucursal → 201', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(auth(adminAToken))
      .send({ code: 'suc01', name: 'Almacén Sucursal', branchId: String(tenantA.branch._id) });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('SUC01');
    warehouseSucId = res.body.data._id;
  });

  test('código de almacén duplicado → 409 canónico', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(auth(adminAToken))
      .send({ code: 'MAIN', name: 'Duplicado' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya existe un registro con ese valor en: code.');
  });

  test('no se puede eliminar el almacén predeterminado → 409', async () => {
    const res = await request(app)
      .delete(`/api/v1/warehouses/${warehouseMainId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('No puede eliminar el almacén predeterminado.');
  });

  // -------------------------------------------------------------------------
  // Entradas
  // -------------------------------------------------------------------------
  test('almacen registra una entrada de 10 → 201', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/entries')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 10, reason: 'Compra inicial' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('ENTRY');
    expect(res.body.data.quantityBefore).toBe(0);
    expect(res.body.data.quantityAfter).toBe(10);
    expect(String(res.body.data.companyId)).toBe(String(tenantA.company._id));
  });

  test('entrada con quantity 0 → 422 (debe ser > 0)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/entries')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
    expect(res.body.error.details.body[0].field).toBe('quantity');
  });

  test('entrada con almacén de OTRA empresa → 404 (nunca 403)', async () => {
    const foreignWarehouse = String(tenantB.warehouse._id);
    const res = await request(app)
      .post('/api/v1/inventory/entries')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: foreignWarehouse, quantity: 5 });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('GET /inventory/stock refleja la existencia con resumen de producto/almacén', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/stock?warehouseId=${warehouseMainId}`)
      .set(auth(consultaToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const row = res.body.data[0];
    expect(row.quantity).toBe(10);
    expect(row.product.sku).toBe('SKU-001');
    expect(row.warehouse.code).toBe('MAIN');
  });

  // -------------------------------------------------------------------------
  // Salidas
  // -------------------------------------------------------------------------
  test('salida por encima del stock → 409 canónico, sin crear movimiento', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/exits')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 100 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Stock insuficiente en el almacén indicado.');
    expect(res.body.error.details.available).toBe(10);
  });

  test('salida válida de 4 → existencias quedan en 6', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/exits')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 4, reason: 'Venta' });

    expect(res.status).toBe(201);
    expect(res.body.data.delta).toBe(-4);
    expect(res.body.data.quantityBefore).toBe(10);
    expect(res.body.data.quantityAfter).toBe(6);

    const stock = await request(app)
      .get('/api/v1/inventory/stock')
      .set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.warehouseId === warehouseMainId).quantity).toBe(6);
  });

  // -------------------------------------------------------------------------
  // Ajustes
  // -------------------------------------------------------------------------
  test('ajuste sin motivo → 422 (reason obligatorio para trazabilidad)', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 5 });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
    expect(res.body.error.details.body.some((d) => d.field === 'reason')).toBe(true);
  });

  test('ajuste a recuento 5 con motivo → 201 y existencias = 5', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set(auth(almacenToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 5, reason: 'Recuento cíclico' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('ADJUSTMENT');
    expect(res.body.data.quantityBefore).toBe(6);
    expect(res.body.data.quantityAfter).toBe(5);

    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.warehouseId === warehouseMainId).quantity).toBe(5);
  });

  // -------------------------------------------------------------------------
  // Movimientos: consulta e inmutabilidad
  // -------------------------------------------------------------------------
  test('GET /inventory/movements lista ENTRY/EXIT/ADJUSTMENT con saldos', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/movements?type=ENTRY')
      .set(auth(consultaToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].product.sku).toBe('SKU-001');

    const all = await request(app)
      .get('/api/v1/inventory/movements?limit=100')
      .set(auth(consultaToken));
    const types = all.body.data.map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(['ENTRY', 'EXIT', 'ADJUSTMENT']));
    lastMovementId = all.body.data[0]._id;
  });

  test('los movimientos son inmutables: no existe PATCH/DELETE → 404', async () => {
    const patch = await request(app)
      .patch(`/api/v1/inventory/movements/${lastMovementId}`)
      .set(auth(adminAToken))
      .send({ quantity: 999999 });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete(`/api/v1/inventory/movements/${lastMovementId}`)
      .set(auth(adminAToken));
    expect(del.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Transferencias
  // -------------------------------------------------------------------------
  test('transferencia MAIN → SUC01 mueve stock entre almacenes', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/transfers')
      .set(auth(almacenToken))
      .send({
        productId,
        fromWarehouseId: warehouseMainId,
        toWarehouseId: warehouseSucId,
        quantity: 2,
        reason: 'Reposición de sucursal',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('TRANSFER');
    expect(res.body.data.toWarehouseId).toBe(String(warehouseSucId));

    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.warehouseId === warehouseMainId).quantity).toBe(3);
    expect(stock.body.data.find((r) => r.warehouseId === warehouseSucId).quantity).toBe(2);
  });

  test('transferencia con origen = destino → 422 con el campo señalado', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/transfers')
      .set(auth(almacenToken))
      .send({
        productId,
        fromWarehouseId: warehouseMainId,
        toWarehouseId: warehouseMainId,
        quantity: 1,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Los datos enviados no son válidos.');
    expect(res.body.error.details.body[0].field).toBe('toWarehouseId');
  });

  // -------------------------------------------------------------------------
  // Aislamiento multiempresa (anti-IDOR)
  // -------------------------------------------------------------------------
  test('IDs de la empresa A para el usuario de la empresa B → 404', async () => {
    const product = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set(auth(adminBToken));
    expect(product.status).toBe(404);

    const movement = await request(app)
      .get(`/api/v1/inventory/movements/${lastMovementId}`)
      .set(auth(adminBToken));
    expect(movement.status).toBe(404);

    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(adminBToken));
    expect(stock.status).toBe(200);
    expect(stock.body.data).toHaveLength(0);
  });

  test('rol sin permiso de inventario: 403 con mensaje canónico', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/entries')
      .set(auth(consultaToken))
      .send({ productId, warehouseId: warehouseMainId, quantity: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: inventory.movements.create.'
    );
  });

  // -------------------------------------------------------------------------
  // Guardas de borrado
  // -------------------------------------------------------------------------
  test('producto CON existencias no se elimina → 409 (desactivar en su lugar)', async () => {
    const res = await request(app)
      .delete(`/api/v1/products/${productId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'El producto tiene existencias en almacenes: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
    );
  });

  test('producto SIN historial se elimina → 200', async () => {
    const created = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'SKU-TEMPO', name: 'Producto Temporal' });
    productNoHistoryId = created.body.data._id;

    const res = await request(app)
      .delete(`/api/v1/products/${productNoHistoryId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ _id: productNoHistoryId, deleted: true });
  });

  // -------------------------------------------------------------------------
  // Guarda de sucursal (FASE 3): almacenes con existencias
  // -------------------------------------------------------------------------
  test('admin crea sucursal NORTE y su almacén vinculado', async () => {
    const branch = await request(app)
      .post('/api/v1/branches')
      .set(auth(adminAToken))
      .send({ code: 'NORTE', name: 'Norte' });
    expect(branch.status).toBe(201);
    branchNorthId = branch.body.data._id;

    const warehouse = await request(app)
      .post('/api/v1/warehouses')
      .set(auth(adminAToken))
      .send({ code: 'NOR01', name: 'Almacén Norte', branchId: String(branchNorthId) });
    expect(warehouse.status).toBe(201);
    warehouseNorthId = warehouse.body.data._id;

    const created = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'SKU-MOV', name: 'Producto Con Historial' });
    expect(created.status).toBe(201);
    productMovId = created.body.data._id;

    const entry = await request(app)
      .post('/api/v1/inventory/entries')
      .set(auth(almacenToken))
      .send({ productId: productMovId, warehouseId: warehouseNorthId, quantity: 5 });
    expect(entry.status).toBe(201);
  });

  test('sucursal con almacén CON existencias no se elimina → 409', async () => {
    const res = await request(app)
      .delete(`/api/v1/branches/${branchNorthId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'La sucursal tiene almacenes con existencias; transfiera o ajuste el stock antes de eliminarla.'
    );
  });

  test('agotado el stock, la sucursal se elimina y sus almacenes se desvinculan', async () => {
    const zeroed = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set(auth(almacenToken))
      .send({
        productId: productMovId,
        warehouseId: warehouseNorthId,
        quantity: 0,
        reason: 'Mercancía devuelta',
      });
    expect(zeroed.status).toBe(201);

    const res = await request(app)
      .delete(`/api/v1/branches/${branchNorthId}`)
      .set(auth(adminAToken));
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const warehouse = await request(app)
      .get(`/api/v1/warehouses/${warehouseNorthId}`)
      .set(auth(adminAToken));
    expect(warehouse.status).toBe(200);
    expect(warehouse.body.data.branchId).toBeNull();
  });

  test('producto con movimientos (existencias a 0) no se elimina → 409', async () => {
    const res = await request(app)
      .delete(`/api/v1/products/${productMovId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'El producto tiene movimientos de inventario: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
    );
  });

  test('almacén con existencias no se elimina → 409', async () => {
    const res = await request(app)
      .delete(`/api/v1/warehouses/${warehouseSucId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('El almacén tiene existencias: no se puede eliminar.');
  });

  // -------------------------------------------------------------------------
  // Auditoría de movimientos
  // -------------------------------------------------------------------------
  test('los movimientos quedan auditados con su resourceId', async () => {
    const settled = await waitFor(async () => {
      const res = await request(app)
        .get('/api/v1/audit?module=inventory&limit=100')
        .set(auth(adminAToken));
      if (res.status !== 200) return false;
      return res.body.data.some(
        (e) => e.action === 'POST_INVENTORY' && e.result === 'SUCCESS' && e.resourceId
      );
    });
    expect(settled).toBe(true);
  });

  test('alertas de stock bajo y sobre máximo calculan existencias del tenant', async () => {
    const invalidLimits = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'ALERT-BAD', name: 'Límites inválidos', minStock: 5, maxStock: 4 });
    expect(invalidLimits.status).toBe(422);

    const product = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'ALERT-01', name: 'Producto con límites', minStock: 2, maxStock: 4 });
    expect(product.status).toBe(201);

    const low = await request(app).get('/api/v1/inventory/alerts').set(auth(adminAToken));
    expect(low.status).toBe(200);
    expect(low.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ sku: 'ALERT-01', currentStock: 0, alertType: 'LOW_STOCK' }),
    ]));
    expect(low.body.data.find((item) => item.sku === 'ALERT-01')).not.toHaveProperty('costPrice');

    const entry = await request(app)
      .post('/api/v1/inventory/entries')
      .set(auth(almacenToken))
      .send({ productId: product.body.data._id, warehouseId: warehouseMainId, quantity: 5 });
    expect(entry.status).toBe(201);
    const high = await request(app).get('/api/v1/inventory/alerts').set(auth(adminAToken));
    expect(high.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ sku: 'ALERT-01', currentStock: 5, alertType: 'OVER_MAXIMUM' }),
    ]));

    const otherTenant = await request(app).get('/api/v1/inventory/alerts').set(auth(adminBToken));
    expect(otherTenant.status).toBe(200);
    expect(otherTenant.body.data).toHaveLength(0);
  });
});
