'use strict';

/**
 * FASE 4 — Compras/Ventas (API + integración).
 *
 * Cubre: proveedores, clientes y órdenes con las reglas del PROMPT:
 *  - RBAC: compras crea órdenes pero NO aprueba; ventas crea pedidos pero NO
 *    aprueba; gerente/administrador aprueban (mensaje canónico 403).
 *  - Documentos DRAFT → APPROVED | REJECTED: editar fuera de borrador ⇒ 409;
 *    sin DELETE (se rechaza); doble aprobación ⇒ 409.
 *  - Aprobar compra = ENTRADAS de inventario; aprobar venta = SALIDAS con
 *    stock validado (409 canónico) y el documento permanece en DRAFT.
 *  - Guardas de borrado de proveedor/cliente con documentos ⇒ 409.
 *  - Multiempresa: IDs ajenos ⇒ 404; listados aislados; auditoría del flujo.
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

describeIfDb('API /suppliers, /customers, /purchase-orders y /sales-orders (integración FASE 4)', () => {
  let tenantA;
  let tenantB;
  let adminAToken;
  let gerenteToken;
  let comprasToken;
  let ventasToken;
  let consultaToken;
  let adminBToken;
  let gerenteUserId;

  let supplierId;
  let supplierNoOrdersId;
  let customerId;
  let productAId;
  let productBId;
  let poId; // PO-000001 aprobada
  let poRejectedId; // PO-000002 rechazada
  let soId; // SO-000001 aprobada
  let soInsufficientId; // SO-000002 con stock insuficiente

  beforeAll(async () => {
    await connectTestDb();

    tenantA = await createTenant({ name: 'Compras Empresa A' });
    tenantB = await createTenant({ name: 'Compras Empresa B' });

    const adminA = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.administrador,
      email: 'admin@f4a.local',
    });
    const gerente = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.gerente,
      email: 'gerente@f4a.local',
    });
    const compras = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.compras,
      email: 'compras@f4a.local',
    });
    const ventas = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.ventas,
      email: 'ventas@f4a.local',
    });
    const consulta = await createUser({
      company: tenantA.company,
      branch: tenantA.branch,
      role: tenantA.roles.consulta,
      email: 'consulta@f4a.local',
    });
    const adminB = await createUser({
      company: tenantB.company,
      branch: tenantB.branch,
      role: tenantB.roles.administrador,
      email: 'admin@f4b.local',
    });

    gerenteUserId = String(gerente._id);

    adminAToken = await login(adminA.email, 'Clave1234');
    gerenteToken = await login(gerente.email, 'Clave1234');
    comprasToken = await login(compras.email, 'Clave1234');
    ventasToken = await login(ventas.email, 'Clave1234');
    consultaToken = await login(consulta.email, 'Clave1234');
    adminBToken = await login(adminB.email, 'Clave1234');

    // Productos del catálogo (sólo administrador puede crear productos).
    const pa = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'F4-PDA', name: 'Producto A', unit: 'pza' });
    expect(pa.status).toBe(201);
    productAId = pa.body.data._id;

    const pb = await request(app)
      .post('/api/v1/products')
      .set(auth(adminAToken))
      .send({ sku: 'F4-PDB', name: 'Producto B', unit: 'pza' });
    expect(pb.status).toBe(201);
    productBId = pb.body.data._id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // -------------------------------------------------------------------------
  // Catálogos: proveedores y clientes
  // -------------------------------------------------------------------------
  test('compras crea proveedor (código en mayúsculas) → 201', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set(auth(comprasToken))
      .send({ code: 'prov-1', name: 'Distribuidora Norte', email: 'ventas@norte.mx' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('PROV-1');
    expect(String(res.body.data.companyId)).toBe(String(tenantA.company._id));
    supplierId = res.body.data._id;
  });

  test('código de proveedor duplicado → 409 canónico', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set(auth(comprasToken))
      .send({ code: 'PROV-1', name: 'Otra' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya existe un registro con ese valor en: code.');
  });

  test('ventas crea cliente → 201', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(auth(ventasToken))
      .send({ code: 'cli-1', name: 'Comercial Central', taxId: 'XAXX010101000' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('CLI-1');
    customerId = res.body.data._id;
  });

  test('consulta NO puede crear proveedores → 403 canónico', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set(auth(consultaToken))
      .send({ code: 'PROV-X', name: 'X' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: suppliers.create.'
    );
  });

  // -------------------------------------------------------------------------
  // Órdenes de compra
  // -------------------------------------------------------------------------
  test('compras crea la orden PO-000001 en DRAFT con total calculado por el servidor', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set(auth(comprasToken))
      .send({
        supplierId,
        lines: [
          { productId: productAId, quantity: 5, unitCost: 10.5 },
          { productId: productBId, quantity: 2, unitCost: 1.5 },
        ],
        notes: 'Reposición semanal',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('PO-000001');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.total).toBe(55.5); // 5×10.5 + 2×1.5
    expect(res.body.data.warehouseId).toBe(String(tenantA.warehouse._id)); // default MAIN
    poId = res.body.data._id;
  });

  test('inyectar status en la orden → 400 (campo de servidor)', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set(auth(comprasToken))
      .send({
        supplierId,
        status: 'APPROVED',
        lines: [{ productId: productAId, quantity: 1, unitCost: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Campos no permitidos: status.');
  });

  test('orden con proveedor de OTRA empresa → 404 (nunca 403)', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set(auth(comprasToken))
      .send({
        supplierId: String(tenantB.warehouse._id), // ID real de otro tenant
        lines: [{ productId: productAId, quantity: 1, unitCost: 1 }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('gerente NO crea órdenes (no tiene purchases.create) → 403 canónico', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set(auth(gerenteToken))
      .send({
        supplierId,
        lines: [{ productId: productAId, quantity: 1, unitCost: 1 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: purchases.create.'
    );
  });

  test('compras NO aprueba su propia orden → 403 canónico', async () => {
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set(auth(comprasToken))
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: purchases.approve.'
    );
  });

  test('gerente aprueba → ENTRADAS de inventario por línea y estado APPROVED', async () => {
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set(auth(gerenteToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.approvedBy).toBe(gerenteUserId);
    expect(res.body.data.approvedAt).toBeTruthy();

    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.productId === productAId).quantity).toBe(5);
    expect(stock.body.data.find((r) => r.productId === productBId).quantity).toBe(2);

    const movements = await request(app)
      .get('/api/v1/inventory/movements?type=ENTRY')
      .set(auth(consultaToken));
    expect(movements.body.data).toHaveLength(2);
    for (const m of movements.body.data) {
      expect(m.reference).toBe('PO-000001');
      expect(m.reason).toBe('Aprobación de orden de compra PO-000001');
    }
  });

  test('doble aprobación → 409', async () => {
    const res = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/approve`)
      .set(auth(gerenteToken))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('La orden ya fue aprobada.');
  });

  test('editar una orden aprobada → 409 (sólo borradores)', async () => {
    const res = await request(app)
      .patch(`/api/v1/purchase-orders/${poId}`)
      .set(auth(comprasToken))
      .send({ notes: 'cambio tardío' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Sólo los documentos en borrador pueden modificarse.');
  });

  // -------------------------------------------------------------------------
  // Pedidos de venta
  // -------------------------------------------------------------------------
  test('ventas crea el pedido SO-000001 en DRAFT → 201', async () => {
    const res = await request(app)
      .post('/api/v1/sales-orders')
      .set(auth(ventasToken))
      .send({
        customerId,
        lines: [{ productId: productAId, quantity: 4, unitPrice: 15 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('SO-000001');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.total).toBe(60);
    soId = res.body.data._id;
  });

  test('pedido con producto de OTRA empresa → 404', async () => {
    const res = await request(app)
      .post('/api/v1/sales-orders')
      .set(auth(ventasToken))
      .send({
        customerId,
        lines: [{ productId: String(tenantB.warehouse._id), quantity: 1, unitPrice: 1 }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recurso no encontrado.');
  });

  test('ventas NO aprueba su propio pedido → 403 canónico', async () => {
    const res = await request(app)
      .post(`/api/v1/sales-orders/${soId}/approve`)
      .set(auth(ventasToken))
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      'No tiene permisos para esta operación. Se requiere: sales.orders.approve.'
    );
  });

  test('gerente aprueba → SALIDAS de inventario (stock A: 5 → 1)', async () => {
    const res = await request(app)
      .post(`/api/v1/sales-orders/${soId}/approve`)
      .set(auth(gerenteToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.productId === productAId).quantity).toBe(1);

    const movements = await request(app)
      .get('/api/v1/inventory/movements?type=EXIT')
      .set(auth(consultaToken));
    expect(movements.body.data).toHaveLength(1);
    expect(movements.body.data[0].reference).toBe('SO-000001');
    expect(movements.body.data[0].quantityAfter).toBe(1);
  });

  test('aprobar pedido sin stock suficiente → 409 canónico y el pedido sigue en DRAFT', async () => {
    const created = await request(app)
      .post('/api/v1/sales-orders')
      .set(auth(ventasToken))
      .send({ customerId, lines: [{ productId: productAId, quantity: 100, unitPrice: 15 }] });
    expect(created.status).toBe(201);
    soInsufficientId = created.body.data._id;

    const res = await request(app)
      .post(`/api/v1/sales-orders/${soInsufficientId}/approve`)
      .set(auth(gerenteToken))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Stock insuficiente en el almacén indicado.');
    expect(res.body.error.details.available).toBe(1);

    const order = await request(app)
      .get(`/api/v1/sales-orders/${soInsufficientId}`)
      .set(auth(ventasToken));
    expect(order.body.data.status).toBe('DRAFT'); // sin aprobación parcial

    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.productId === productAId).quantity).toBe(1); // intacto
  });

  // -------------------------------------------------------------------------
  // Rechazo (no toca inventario)
  // -------------------------------------------------------------------------
  test('rechazar orden con motivo → REJECTED; aprobarla después → 409', async () => {
    const created = await request(app)
      .post('/api/v1/purchase-orders')
      .set(auth(comprasToken))
      .send({
        supplierId,
        lines: [{ productId: productAId, quantity: 1, unitCost: 2 }],
      });
    expect(created.status).toBe(201);
    poRejectedId = created.body.data._id;
    expect(created.body.data.code).toBe('PO-000002');

    const rejected = await request(app)
      .post(`/api/v1/purchase-orders/${poRejectedId}/reject`)
      .set(auth(gerenteToken))
      .send({ reason: 'Sin presupuesto este mes' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(rejected.body.data.rejectionReason).toBe('Sin presupuesto este mes');

    const approve = await request(app)
      .post(`/api/v1/purchase-orders/${poRejectedId}/approve`)
      .set(auth(gerenteToken))
      .send({});
    expect(approve.status).toBe(409);
    expect(approve.body.error.message).toBe('La orden fue rechazada; no puede aprobarse.');

    // El rechazo no movió stock: sigue en 1.
    const stock = await request(app).get('/api/v1/inventory/stock').set(auth(consultaToken));
    expect(stock.body.data.find((r) => r.productId === productAId).quantity).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Guardas de borrado de catálogos
  // -------------------------------------------------------------------------
  test('proveedor sin órdenes se elimina → 200; con órdenes → 409', async () => {
    const fresh = await request(app)
      .post('/api/v1/suppliers')
      .set(auth(comprasToken))
      .send({ code: 'PROV-2', name: 'Proveedor Sin Historial' });
    supplierNoOrdersId = fresh.body.data._id;

    const del = await request(app)
      .delete(`/api/v1/suppliers/${supplierNoOrdersId}`)
      .set(auth(adminAToken));
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);

    const guarded = await request(app)
      .delete(`/api/v1/suppliers/${supplierId}`)
      .set(auth(adminAToken));
    expect(guarded.status).toBe(409);
    expect(guarded.body.error.message).toBe(
      'El proveedor tiene órdenes de compra: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
    );
  });

  test('cliente con pedidos de venta no se elimina → 409', async () => {
    const res = await request(app)
      .delete(`/api/v1/customers/${customerId}`)
      .set(auth(adminAToken));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'El cliente tiene pedidos de venta: no se puede eliminar. Desactívelo (status inactive) en su lugar.'
    );
  });

  // -------------------------------------------------------------------------
  // Listados y aislamiento
  // -------------------------------------------------------------------------
  test('filtros de listado por status, proveedor y búsqueda de código', async () => {
    const approved = await request(app)
      .get('/api/v1/purchase-orders?status=APPROVED')
      .set(auth(consultaToken));
    expect(approved.status).toBe(200);
    expect(approved.body.data.map((o) => o.code)).toContain('PO-000001');
    expect(approved.body.data.map((o) => o.code)).not.toContain('PO-000002');

    const bySupplier = await request(app)
      .get(`/api/v1/purchase-orders?supplierId=${supplierId}`)
      .set(auth(consultaToken));
    expect(bySupplier.body.meta.total).toBe(2);

    const searched = await request(app)
      .get('/api/v1/purchase-orders?search=PO-000001')
      .set(auth(consultaToken));
    expect(searched.body.data).toHaveLength(1);
    expect(searched.body.data[0].code).toBe('PO-000001');
  });

  test('empresa B no ve ni usa recursos de la empresa A → 404 y listados vacíos', async () => {
    const supplier = await request(app)
      .get(`/api/v1/suppliers/${supplierId}`)
      .set(auth(adminBToken));
    expect(supplier.status).toBe(404);

    const order = await request(app)
      .get(`/api/v1/purchase-orders/${poId}`)
      .set(auth(adminBToken));
    expect(order.status).toBe(404);

    const list = await request(app).get('/api/v1/purchase-orders').set(auth(adminBToken));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);

    // Además, su orden no puede referenciar el proveedor de A.
    const create = await request(app)
      .post('/api/v1/purchase-orders')
      .set(auth(adminBToken))
      .send({
        supplierId,
        lines: [{ productId: productAId, quantity: 1, unitCost: 1 }],
      });
    expect(create.status).toBe(404); // proveedor ajeno se resuelve primero
  });

  // -------------------------------------------------------------------------
  // Auditoría
  // -------------------------------------------------------------------------
  test('la aprobación de la orden queda auditada con su resourceId', async () => {
    const settled = await waitFor(async () => {
      const res = await request(app)
        .get('/api/v1/audit?module=purchase-orders&limit=100')
        .set(auth(adminAToken));
      if (res.status !== 200) return false;
      return res.body.data.some(
        (e) =>
          e.action === 'POST_PURCHASE-ORDERS' &&
          e.result === 'SUCCESS' &&
          e.resourceId === poId
      );
    });
    expect(settled).toBe(true);
  });

  test('compras y ventas aplican lotes trazables al aprobar y no omiten el control', async () => {
    const supplier = await request(app).post('/api/v1/suppliers').set(auth(comprasToken)).send({
      code: 'TRACE-PROV', name: 'Proveedor trazable',
    });
    const customer = await request(app).post('/api/v1/customers').set(auth(ventasToken)).send({
      code: 'TRACE-CLI', name: 'Cliente trazable',
    });
    const product = await request(app).post('/api/v1/products').set(auth(adminAToken)).send({
      sku: 'TRACE-LOT', name: 'Artículo por lote', trackingMode: 'lot',
    });
    expect([supplier.status, customer.status, product.status]).toEqual([201, 201, 201]);

    const purchase = await request(app).post('/api/v1/purchase-orders').set(auth(comprasToken)).send({
      supplierId: supplier.body.data._id,
      lines: [{ productId: product.body.data._id, quantity: 4, unitCost: 10, traceability: [{ identifier: 'BUY-LOT', quantity: 4 }] }],
    });
    expect(purchase.status).toBe(201);
    const approvedPurchase = await request(app).post(`/api/v1/purchase-orders/${purchase.body.data._id}/approve`).set(auth(gerenteToken)).send({});
    expect(approvedPurchase.status).toBe(200);

    const missingTrace = await request(app).post('/api/v1/sales-orders').set(auth(ventasToken)).send({
      customerId: customer.body.data._id,
      lines: [{ productId: product.body.data._id, quantity: 1, unitPrice: 20 }],
    });
    expect(missingTrace.status).toBe(201);
    const rejectedSale = await request(app).post(`/api/v1/sales-orders/${missingTrace.body.data._id}/approve`).set(auth(gerenteToken)).send({});
    expect(rejectedSale.status).toBe(422);

    const sale = await request(app).post('/api/v1/sales-orders').set(auth(ventasToken)).send({
      customerId: customer.body.data._id,
      lines: [{ productId: product.body.data._id, quantity: 3, unitPrice: 20, traceability: [{ identifier: 'BUY-LOT', quantity: 3 }] }],
    });
    expect(sale.status).toBe(201);
    const approvedSale = await request(app).post(`/api/v1/sales-orders/${sale.body.data._id}/approve`).set(auth(gerenteToken)).send({});
    expect(approvedSale.status).toBe(200);
    const trace = await request(app).get(`/api/v1/inventory/traceability?productId=${product.body.data._id}`).set(auth(adminAToken));
    expect(trace.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ identifier: 'BUY-LOT', quantity: 1 })]));
  });
});
