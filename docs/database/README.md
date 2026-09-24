# Base de datos (MongoDB Atlas)

Sufijo de base recomendado: `erp` (dev), `erp_test` (pruebas, descartable).

## Colecciones (FASE 1 + 2 + 3 + 4 + 5 + 6)

### `master_data` (FASE 2)
Catálogo compartido y tipado por empresa: `category`, `brand`, `unit`, `currency`, `tax`. Campos según tipo: `code`, `name`, `symbol`, `decimalPlaces`, `allowFractions`, `rate`, `status`. Índices: `{companyId:1,type:1,code:1}` **unique** y `{companyId:1,type:1,status:1,name:1}`. Los IDs de producto/finanzas/empresa apuntan a registros del mismo tenant. La migración `npm run migrate:master-data` es idempotente y enlaza snapshots históricos; conserva los campos de texto para compatibilidad. No ejecutarla directamente contra producción sin respaldo y ventana de despliegue.

### `sessions` (FASE 1)
Sesiones de refresh con `userId`, `companyId`, `tokenVersion`, `refreshIdHash` (SHA-256; el token nunca se persiste), `expiresAt` y `consumedAt`. La rotación consume el registro atómicamente; hay índice TTL en `expiresAt` y búsqueda por usuario/consumo/expiración.

`companies.settings` expone sólo `locale`, `dateFormat` y `fiscalYearStartMonth`; la API valida las claves y deriva la empresa exclusivamente del usuario autenticado.

### `companies` — tenant raíz (entidad de PLATAFORMA, sin `companyId`)
Campos: `name` (único), `legalName`, `taxId` (único sparse), `email`, `phone`, `address`, `currency` (default `MXN`), `timezone`, `status: active|suspended`, `settings`, timestamps.
Índices: `{name:1}` unique · `{taxId:1}` sparse · `{status:1}`.

### `branches` — sucursales (siempre `companyId`)
Campos: `companyId`, `code` (mayúsculas), `name`, `address`, `phone`, `isDefault`, `status: active|inactive`.
Índices: `{companyId:1, code:1}` **unique** (código único POR empresa) · `{companyId:1, status:1}`.

### `roles` — roles RBAC (con `companyId`; `null` = plataforma)
Campos: `companyId`, `code` (minúsculas), `label`, `description`, `permissions[]` (códigos del catálogo en código, ADR-002), `isSystem`, `status: active|inactive`.
Índices: `{companyId:1, code:1}` unique · `{companyId:1, status:1}`.

### `users` — cuentas (login `email` único GLOBAL; `null` de empresa = Super Admin)
Campos: `companyId`, `branchId`, `roleId`, `name`, `lastName`, `email`, `passwordHash` (**`select:false`**), `status: active|inactive|locked`, `isPlatformAdmin`, `lastLoginAt`, `failedLoginAttempts`, `tokenVersion`, `resetPasswordTokenHash/ExpiresAt` (`select:false`).
Índices: `email` unique · `{companyId:1,status:1}` · `{companyId:1,email:1}` · `{companyId:1,roleId:1}`.

### `audit_logs` — bitácora inmutable (sólo lectura vía API)
Campos: `companyId` (`null` = plataforma), `userId`, `userEmail`, `module`, `action`, `resourceType`, `resourceId`, `before`, `after` (redactados), `ip`, `userAgent`, `result: SUCCESS|FAILURE`, `statusCode`, `message`, `expiresAt` (retención), `createdAt`.
Índices: `{companyId:1,createdAt:-1}` · `{companyId:1,module:1,createdAt:-1}` · `{companyId:1,userId:1,createdAt:-1}` · **TTL** `{expiresAt:1}` `expireAfterSeconds:0` (borra sólo si `expiresAt` es fecha; `null` = retención indefinida).
Inmutabilidad: hooks de Mongoose bloquean updates/borrados (el TTL del servidor no pasa por ellos).

### `products` — catálogo de productos (FASE 3)
Campos: `companyId`, `sku` (mayúsculas), `name`, `barcode`, `description`, `categoryId/brandId/unitId/taxId` (referencias opcionales a `master_data`), snapshots legados `category/brand/unit/taxRate`, `costPrice`, `salePrice`, `minStock`, `maxStock` (nullable; `maxStock >= minStock`), `status: active|inactive`, timestamps.
Índices: `{companyId:1, sku:1}` **unique** · `{companyId:1, status:1}` · `{companyId:1, name:1}`.

### `warehouses` — almacenes (FASE 3; empresa nace con `MAIN`)
Campos: `companyId`, `branchId` (`null` = sin sucursal; se desvincula al borrar la sucursal), `code` (mayúsculas), `name`, `address`, `isDefault`, `status: active|inactive`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1}`.

### `stock_levels` — existencias por almacén/producto (FASE 3)
Campos: `companyId`, `warehouseId`, `productId`, `quantity` (**invariante `>= 0`**), timestamps.
Índices: `{companyId:1, warehouseId:1, productId:1}` **unique** (fila única) · `{companyId:1, productId:1}`.
Operaciones atómicas (ADR-008): `increment` (upsert + `$inc`), `decrementConditional` (`quantity: {$gte}`), `setExact` (optimista), `createIfAbsent` (11000 ⇒ carrera).

### `inventory_movements` — histórico inmutable de movimientos (FASE 3, append-only)
Campos: `companyId`, `type: ENTRY|EXIT|ADJUSTMENT|TRANSFER`, `productId`, `warehouseId` (origen/referencia), `toWarehouseId` (sólo TRANSFER), `quantity`, `delta`, `quantityBefore`, `quantityAfter`, `reason`, `reference`, `userId`, timestamps.
Índices: `{companyId:1, createdAt:-1}` · `{companyId:1, productId:1, createdAt:-1}` · `{companyId:1, warehouseId:1, createdAt:-1}` · `{companyId:1, type:1, createdAt:-1}`.
La API **no** expone PATCH/DELETE: el saldo se reconstruye desde `quantityBefore/After`.

Los productos añaden `trackingMode: none|lot|serial`. La colección `inventory_traces` mantiene cantidades por lote y almacén, o una fila por serie con almacén y cantidad activa/inactiva. Los movimientos conservan el snapshot `traceability[]`; su índice parcial único tenant-scoped sobre `idempotencyKey` soporta la publicación reanudable de conteos.

La colección `inventory_counts` persiste `companyId`, código, almacén, estado (`DRAFT|POSTING|PARTIAL|POSTED`) y líneas con cantidades esperadas/contadas, aplicación y movimiento generado. Los conteos actuales se limitan a productos no trazables; no publicar conteos de lotes/series hasta implementar una conciliación que valide y aplique tanto el agregado como cada identificador.

### `suppliers` — proveedores (FASE 4)
Campos: `companyId`, `code` (mayúsculas), `name`, `contactName`, `email`, `phone`, `address`, `notes`, `status: active|inactive`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1}`.

### `customers` — clientes (FASE 4)
Campos: `companyId`, `code` (mayúsculas), `name`, `taxId`, `email`, `phone`, `notes`, `status: active|inactive`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1}`.

### `purchase_orders` — órdenes de compra (FASE 4, flujo ADR-010)
Campos: `companyId`, `code` (`PO-000001…` único por empresa), `supplierId`, `warehouseId` (destino de la entrada), `status: DRAFT|APPROVED|REJECTED`, `lines[]: {productId, quantity ≥ 1, unitCost ≥ 0}`, `total` (calculado por servidor), `notes`, `createdBy`, `approvedBy/approvedAt`, `rejectedBy/rejectedAt/rejectionReason`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1, createdAt:-1}` · `{companyId:1, supplierId:1, createdAt:-1}` · `{companyId:1, createdAt:-1}`.

### `sales_orders` — pedidos de venta (FASE 4, flujo ADR-010)
Campos: `companyId`, `code` (`SO-000001…` único por empresa), `customerId`, `warehouseId` (origen de la salida), `status: DRAFT|APPROVED|REJECTED`, `lines[]: {productId, quantity ≥ 1, unitPrice ≥ 0}`, `total` (calculado por servidor), `notes`, `createdBy`, `approvedBy/approvedAt`, `rejectedBy/rejectedAt/rejectionReason`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1, createdAt:-1}` · `{companyId:1, customerId:1, createdAt:-1}` · `{companyId:1, createdAt:-1}`.

### `counters` — numeración secuencial por empresa (FASE 4, ADR-009)
Campos: `companyId`, `key` (`purchase_orders`, `sales_orders`, `incomes`, `expenses`…), `seq` (incremento atómico `$inc` con upsert).
Índices: `{companyId:1, key:1}` **unique**.

### `finance_accounts` — cuentas de efectivo/banco (FASE 5)
Campos: `companyId`, `code` (mayúsculas), `name`, `type: bank|cash|wallet`, `currency` (ISO-3), `balance` (**sólo servidor**, escritura optimista condicionada, ADR-011), `status: active|inactive`, `notes`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1}`.

### `incomes` — ingresos (FASE 5, append-only ADR-011)
Campos: `companyId`, `code` (`INC-000001…` único por empresa), `amount > 0`, `date`, `category`, `method: cash|transfer|card|check|other`, `accountId`, `customerId`, `reference`, `description`, `status: POSTED|VOID`, `voidedBy/voidedAt/voidReason`, `createdBy`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, date:-1}` · `{companyId:1, accountId:1, date:-1}` · `{companyId:1, category:1, date:-1}`.
La API **no** expone PATCH/DELETE: sólo `POST /:id/void`, que invierte el saldo de la cuenta.

### `expenses` — gastos (FASE 5, append-only ADR-011)
Campos: análogos a `incomes` con `supplierId` opcional y `code` `EXP-000001…`.
Índices: mismos que `incomes` (`code`, `date`, `accountId+date`, `category+date`).

### `budgets` — presupuestos por categoría (FASE 5)
Campos: `companyId`, `year`, `month`, `category`, `plannedAmount ≥ 0`, `notes`, `createdBy`, timestamps.
Índices: `{companyId:1, year:1, month:1, category:1}` **unique** · `{companyId:1, year:1, month:1}`.
Sólo guarda lo planeado: lo ejecutado se calcula al vuelo desde `expenses` (ADR-011).

### `leads` — prospectos CRM (FASE 6, ciclo ADR-012)
Campos: `companyId`, `name`, `company`, `email`, `phone`, `source: web|referral|call|event|other`, `status: NEW|CONTACTED|QUALIFIED|WON|LOST`, `expectedAmount ≥ 0`, `notes`, `assignedTo` (usuario de la empresa), `createdBy`, timestamps.
Índices: `{companyId:1, status:1, createdAt:-1}` · `{companyId:1, createdAt:-1}` · `{companyId:1, name:1}`.
La API **no** expone DELETE: la baja es la transición a estado terminal (`WON`/`LOST`), que además cierra el registro a modificaciones (409).

### `employees` — empleados/RRHH (FASE 6, lifecycle ADR-012)
Campos: `companyId`, `documentId` (**único por empresa**), `firstName`, `lastName`, `email`, `position`, `department`, `hireDate`, `salary ≥ 0`, `status: active|inactive`, `terminationDate`, `notes`, `createdBy`, timestamps.
Índices: `{companyId:1, documentId:1}` **unique** · `{companyId:1, status:1, createdAt:-1}` · `{companyId:1, department:1}` · `{companyId:1, lastName:1}`.
La API **no** expone DELETE: la baja es `status: inactive` (reactivación = `active`).

### `boms` — listas de materiales (FASE 6)
Campos: `companyId`, `code` (`BOM-000001…` único por empresa, ADR-009), `productId` (producto terminado), `components[]: {productId, quantity > 0}` (sin repetidos ni autoreferencia, ADR-013), `notes`, `status: active|inactive`, `createdBy`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, productId:1}` · `{companyId:1, status:1, createdAt:-1}`.
Una OT sólo puede usar una BOM `active`; al liberar la orden, los componentes se copian (snapshot) a `production_orders.lines`.

### `production_orders` — órdenes de producción (FASE 6, flujo ADR-013)
Campos: `companyId`, `code` (`MO-000001…` único por empresa, ADR-009), `bomId`, `productId`, `warehouseId`, `quantity > 0`, `status: DRAFT|RELEASED|DONE|CANCELLED`, `lines[]: {productId, quantity}` (snapshot escrito en RELEASE), `notes`, `createdBy`, `releasedBy/releasedAt`, `doneBy/doneAt`, `cancelledBy/cancelledAt`, `cancelReason`, timestamps.
Índices: `{companyId:1, code:1}` **unique** · `{companyId:1, status:1, createdAt:-1}` · `{companyId:1, bomId:1}` · `{companyId:1, createdAt:-1}`.
RELEASE = salida de componentes con compensaciones (ADR-008); DONE = entrada del producto terminado; CANCELLED desde RELEASED devuelve el material. Sin DELETE (ADR-012).

## Reglas

1. Toda query de datos de negocio DEBE llevar `companyId` (garantiza `BaseRepository`, ADR-004).
2. El `companyId` proviene del token, nunca del cliente.
3. Unicidades compuestas por empresa (nada único global salvo login `email` y nombres de empresa).
4. Tras cambiar índices/esquemas: `npm run indexes` (`Model.syncIndexes()`).
5. Borrado físico sólo con guardas (en uso/predeterminado/último admin); usuarios y empresas usan borrado lógico (ADR-006).

## Plan de crecimiento (fases siguientes)

- FASE 3: `products`, `warehouses`, `stock_levels`, `inventory_movements` implementan flujos base; lotes, series e inventario físico formal aún pendientes (índices arriba).
- ~~FASE 4: `suppliers`, `customers`, `purchase_orders`, `sales_orders`, `counters`~~ ✅ implementadas (índices arriba).
- ~~FASE 5: `finance_accounts`, `incomes`, `expenses`, `budgets`~~ ✅ implementadas (índices arriba; los reportes no tienen colección propia: son agregaciones en línea, ADR-011).
- ~~FASE 6: `leads`, `employees`, `boms`, `production_orders`~~ ✅ implementadas (índices arriba).
- FASE 7+: nuevos módulos (nómina, marketing, compras/ventas avanzadas, móvil)… — misma regla de tenant.
