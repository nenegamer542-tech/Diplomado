# API Core (FASE 2 + 3 + 4 + 5 + 6) — `/api/v1`

## Formato de respuesta

```jsonc
// Éxito
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Los datos enviados no son válidos.", "details": [ { "field": "email", "message": "Correo electrónico inválido." } ] } }
```

Mensajes canónicos: validación `Los datos enviados no son válidos.` · permisos `No tiene permisos para esta operación. Se requiere: <permiso>.` · 404 `Recurso no encontrado.` · duplicado `Ya existe un registro con ese valor en: <campo>.` · 500 `Ocurrió un error interno. Intente de nuevo o contacte al administrador.`

Autenticación: `Authorization: Bearer <accessToken>`.

## Endpoints

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/health` | público | health check |
| POST | `/auth/login` | público (rate limit estricto) | `{ email, password }` → `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | público | `{ refreshToken }` → par nuevo; cada refresh sólo se acepta una vez |
| POST | `/auth/logout` | autenticado | logout GLOBAL (`tokenVersion++`) |
| GET | `/auth/me` | autenticado | `{ user, role, company, branch }` |
| POST | `/auth/change-password` | autenticado (rate limit) | `{ currentPassword, newPassword }` |
| GET/POST | `/companies` | plataforma (`companies.*`) | listar / crear (aprovisiona sucursal + 10 roles) |
| GET | `/companies/me` | miembro de empresa | empresa del usuario (header del frontend) |
| GET/PATCH | `/companies/me/settings` | `settings.read/update` | ajustes acotados al tenant autenticado; PATCH parcial validado |
| GET/PATCH/DELETE | `/companies/:id` | `companies.read/update/delete` | detalle / editar (plataforma o admin de la empresa) / suspender (plataforma) |
| GET/POST | `/master-data/:type` | `masterdata.read/create` | catálogos `categories`, `brands`, `units`, `currencies`, `taxes`; companyId se deriva del token |
| GET/PATCH/DELETE | `/master-data/:type/:id` | `masterdata.read/update/delete` | detalle, edición y borrado protegido si el maestro está en uso |
| GET | `/inventory/alerts` | `inventory.read` | Productos activos cuyo stock agregado entre almacenes está en/bajo el mínimo o en/sobre el máximo |
| GET | `/inventory/traceability` | `inventory.read` | Lotes/series activos por `productId` y `warehouseId` opcionales; aislamiento por empresa del token |
| GET | `/inventory/counts` · `/inventory/counts/:id` | `inventory.read` | Lista y detalle de conteos físicos tenant-scoped |
| POST | `/inventory/counts` | `inventory.adjustments.create` | Crea conteo por almacén con `lines: [{ productId, countedQuantity, traceability? }]`; para lotes/series el detalle debe sumar/coincidir con `countedQuantity` |
| POST | `/inventory/counts/:id/post` | `inventory.adjustments.create` | Publica cantidades y trazabilidad; detecta stock/detalle obsoleto, aplica una vez por línea, permite reanudar publicación parcial; conteo repetido ya publicado da 409 |

Los productos pueden recibir `categoryId`, `brandId`, `unitId` y `taxId`; se validan dentro del tenant y deben estar activos. Los campos de texto existentes siguen como snapshots para compatibilidad y se sincronizan al editar el maestro. Las cuentas aceptan `currencyId`; la moneda debe pertenecer al tenant. Cada empresa nueva se aprovisiona con el maestro de su moneda base.
| GET/POST | `/branches` | `branches.read/create` | sucursales del tenant (`requireTenant`) |
| GET/PATCH/DELETE | `/branches/:id` | `branches.*` | guardas: predeterminada, en uso, única |
| GET/POST | `/roles` | `roles.read/create` | roles del tenant; creación con anti-escalada |
| GET | `/roles/permissions` | `roles.read` | catálogo de permisos (editor de roles) |
| GET/PATCH/DELETE | `/roles/:id` | `roles.*` | `isSystem` → 409; en uso → 409 |
| GET/POST | `/users` | `users.read/create` | listado scoped por token; Super Admin: `?allCompanies=true` |
| GET/PATCH/DELETE | `/users/:id` | `users.*` | borrado lógico; auto-protección; último admin → 409 |
| GET | `/audit` · `/audit/:id` | `audit.read` | SOLO lectura (sin POST/PUT/DELETE); Super Admin: `?allCompanies=true` (plataforma) |
| GET/POST | `/products` | `products.read/create` | catálogo de productos; SKU único **por empresa** (mayúsculas) |
| GET/PATCH/DELETE | `/products/:id` | `products.*` | guardas de borrado: con existencias o movimientos → 409 (desactivar) |
| GET/POST | `/warehouses` | `warehouses.read/create` | almacenes del tenant; la empresa nace con `MAIN`; código único por empresa |
| GET/PATCH/DELETE | `/warehouses/:id` | `warehouses.*` | guardas: predeterminado / único / con existencias / con movimientos → 409 |
| GET | `/inventory/stock` | `inventory.read` | existencias por almacén/producto (hidrata `product`/`warehouse`); filtros `warehouseId`, `productId` |
| GET | `/inventory/movements` · `/inventory/movements/:id` | `inventory.read` | histórico inmutable; filtros `type` (ENTRY/EXIT/ADJUSTMENT/TRANSFER), `productId`, `warehouseId`, `from`, `to` |
| POST | `/inventory/entries` | `inventory.movements.create` | alta de stock (upsert + `$inc`); compensación si falla el movimiento |
| POST | `/inventory/exits` | `inventory.movements.create` | decremento **condicional atómico**; sin stock ⇒ 409 `Stock insuficiente en el almacén indicado.` |
| POST | `/inventory/adjustments` | `inventory.adjustments.create` | recuento absoluto (optimista); `reason` obligatorio; carrera ⇒ 409 de reintento |
| POST | `/inventory/transfers` | `inventory.transfers.create` | origen≠destino (422 si no); descuenta origen y acredita destino con compensaciones |
| GET/POST | `/suppliers` | `suppliers.read/create` | proveedores; código único por empresa; búsqueda `code/name/email` |
| GET/PATCH/DELETE | `/suppliers/:id` | `suppliers.*` | guardas: con órdenes de compra ⇒ 409 (desactivar) |
| GET/POST | `/customers` | `customers.read/create` | clientes; código único por empresa; búsqueda `code/name/taxId/email` |
| GET/PATCH/DELETE | `/customers/:id` | `customers.*` | guardas: con pedidos de venta ⇒ 409 (desactivar) |
| GET/POST | `/purchase-orders` | `purchases.read/create` | documentos `PO-000001…` (contador por empresa); filtros `status`, `supplierId`, `search`; `total` calculado por servidor |
| GET/PATCH | `/purchase-orders/:id` | `purchases.read/update` | edición sólo en `DRAFT` (409 en otro estado); sin DELETE (rechazar en su lugar) |
| POST | `/purchase-orders/:id/approve` | `purchases.approve` | `DRAFT → APPROVED` + ENTRADA por línea; fallo ⇒ compensación y sigue `DRAFT`; doble aprobar ⇒ 409 |
| POST | `/purchase-orders/:id/reject` | `purchases.approve` | `DRAFT → REJECTED` con `reason`; no toca inventario |
| GET/POST | `/sales-orders` | `sales.orders.read/create` | documentos `SO-000001…`; filtros `status`, `customerId`, `search` |
| GET/PATCH | `/sales-orders/:id` | `sales.orders.read/update` | edición sólo en `DRAFT`; sin DELETE |
| POST | `/sales-orders/:id/approve` | `sales.orders.approve` | `DRAFT → APPROVED` + SALIDA por línea; sin stock ⇒ 409 canónico y sigue `DRAFT` |
| POST | `/sales-orders/:id/reject` | `sales.orders.approve` | `DRAFT → REJECTED` con `reason`; no toca inventario |
| GET/POST | `/finance/accounts` | `finance.accounts.read/create` | cuentas `bank\|cash\|wallet`; código único por empresa; `balance` SÓLO servidor |
| GET/PATCH/DELETE | `/finance/accounts/:id` | `finance.accounts.*` | con movimientos ⇒ 409 (desactivar); sin movimientos ⇒ borrado |
| GET/POST | `/finance/incomes` | `finance.income.read/create` | `INC-000001…` (contador por empresa) **append-only**; filtros `status`, `accountId`, `category`, `from`, `to` |
| POST | `/finance/incomes/:id/void` | `finance.income.void` | anula con `reason` e **invierte el saldo**; sólo `POSTED`; doble ⇒ 409 |
| GET/POST | `/finance/expenses` | `finance.expenses.read/create` | `EXP-000001…` append-only; débito sin saldo ⇒ 409 `Saldo insuficiente en la cuenta indicado.` |
| POST | `/finance/expenses/:id/void` | `finance.expenses.void` | repone el dinero descontado (corrección contable) |
| GET/POST | `/finance/budgets` | `finance.budgets.read/create` | clave única (empresa, año, mes, categoría) |
| GET/PATCH/DELETE | `/finance/budgets/:id` | `finance.budgets.*` | duplicado ⇒ 409 canónico de la clave |
| GET | `/reports/kpis` | `reports.read` | ventas/compras aprobadas, ingresos/gastos/neto, conteos y stock bajo; `?from&to` |
| GET | `/reports/sales` · `/reports/purchases` | `reports.read` | totales por estado + serie mensual de aprobadas; `?from&to` |
| GET | `/reports/inventory` | `reports.read` | existencia valorizada a costo + productos con stock bajo |
| GET | `/reports/finance` | `reports.read` | ingresos/gastos/neto por categoría y saldos de cuentas; `?year&month`, `?year` o `?from&to` |
| GET | `/reports/budgets` | `reports.read` | planeado vs ejecutado (mensual o anual); `year` obligatorio |
| GET | `/reports/finance/export` | `reports.export` | CSV (UTF-8 con BOM) de ingresos+gastos del periodo |
| GET/POST | `/crm/leads` | `crm.read/create` | ciclo `NEW → CONTACTED → QUALIFIED → WON\|LOST`; filtros `status`, `source`, `assignedTo`; `assignedTo` validado en la empresa (ajeno ⇒ 404) |
| GET/PATCH | `/crm/leads/:id` | `crm.read/update` | transición fuera del ciclo ⇒ 409 `La transición de estado no está permitida.`; lead `WON/LOST` cerrado ⇒ 409 |
| GET/POST | `/hr/employees` | `hr.read/create` | `documentId` único **por empresa** ⇒ 409 con `details.fields`; filtros `status`, `department` |
| GET/PATCH | `/hr/employees/:id` | `hr.read/update` | baja = `status: inactive` (reactivación = `active`) |
| GET/POST | `/production/boms` | `production.read/create` | `BOM-000001…` (contador por empresa); producto final + componentes activos, sin repetidos ni autoreferencia (422) |
| GET/PATCH | `/production/boms/:id` | `production.read/update` | lifecycle `active\|inactive`; inactiva no admite nuevas OT (409) |
| GET/POST | `/production/orders` | `production.read/create` | `MO-000001…`; `warehouseId` opcional (usa el predeterminado); sólo `DRAFT` se edita |
| GET/PATCH | `/production/orders/:id` | `production.read/update` | `Sólo los documentos en borrador pueden modificarse.` (409 fuera de DRAFT) |
| POST | `/production/orders/:id/release` | `production.update` | `DRAFT→RELEASED` (cuerpo vacío): snapshot de componentes escalados + SALIDA por componente; stock insuficiente ⇒ 409 canónico con **compensación** y la OT sigue `DRAFT` |
| POST | `/production/orders/:id/done` | `production.update` | `RELEASED→DONE` (cuerpo vacío): ENTRADA del producto terminado; en `DRAFT` ⇒ 409 |
| POST | `/production/orders/:id/cancel` | `production.update` | `DRAFT\|RELEASED→CANCELLED` con `reason` obligatorio (422 si falta); desde `RELEASED` devuelve el material |

> **No existe `PATCH`/`DELETE` sobre `/inventory/movements`:** el histórico es inmutable (404 en esas rutas). Ver ADR-008. Los documentos de compra/venta tampoco exponen `DELETE`: se crean en `DRAFT` y sólo se aprueban o rechazan (ADR-010). Tampoco existen `PATCH`/`DELETE` sobre `/finance/incomes` y `/finance/expenses`: son **append-only** y sólo admiten anulación con motivo (404 en esas rutas, ADR-011). Tampoco existen `DELETE` sobre `/crm/leads`, `/hr/employees`, `/production/boms` ni `/production/orders`: la baja siempre es un cambio de estado del ciclo de vida (404 en esas rutas, ADR-012).

Parámetros comunes de listado: `?page=1&limit=20&search=&sortBy=&sortDir=asc|desc` (+ filtros `status`, `roleId`, `branchId` donde aplique).

La sesión de refresh se persiste en `sessions`: la API almacena un hash del identificador, lo consume atómicamente al rotar y rechaza tokens usados, expirados o revocados. El logout y el cambio de contraseña conservan la revocación global mediante `tokenVersion`.

## Ejemplo de flujo

```http
POST /api/v1/auth/login
{ "email": "admin@demo.example.com", "password": "..." }
→ 200 { "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "user": { ... } } }

GET /api/v1/users
Authorization: Bearer <accessToken>
→ 200 { "success": true, "data": [ ...usuarios de ESA empresa... ], "meta": { ... } }

GET /api/v1/users/<id-de-otra-empresa>
→ 404 { "success": false, "error": { "code": "NOT_FOUND", "message": "Recurso no encontrado." } }
```

## Códigos de error relevantes

`UNAUTHORIZED`/`TOKEN_EXPIRED`/`TOKEN_INVALID`/`TOKEN_REVOKED`/`INVALID_CREDENTIALS`/`ACCOUNT_LOCKED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `VALIDATION_ERROR` (422) · `RATE_LIMIT` (429) · `INTERNAL_ERROR` (500).

## Multiempresa

El filtro `companyId` **siempre** se inyecta del token, jamás del request: manipular IDs en la URL no cruza empresas (devuelve 404). Detalle en `docs/architecture/decisions.md` (ADR-004).
