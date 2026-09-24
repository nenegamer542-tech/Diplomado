# CHANGELOG

## Seguimiento FASE 2 — 2026-09-24
- Añadidos catálogos maestros por empresa para categorías, marcas, unidades, monedas e impuestos con permisos RBAC, validación estricta, unicidad tenant-scoped y bloqueo de borrado cuando hay referencias.
- Productos validan referencias del mismo tenant y conservan snapshots compatibles; las cuentas financieras aceptan moneda del catálogo. El alta de empresa aprovisiona su moneda base.
- Añadida migración idempotente para enlazar los productos/cuentas/empresas existentes y completar permisos de roles de sistema; la semilla también incorpora permisos nuevos sin retirar los existentes.
- QA específico: 42/42 pruebas objetivo aprobadas. Falta terminar la regresión completa antes de declarar la fase aprobada.

## Seguimiento FASE 1 — 2026-09-24
- Refresh tokens ahora incluyen un identificador aleatorio; se persiste únicamente su hash en `sessions` con vencimiento TTL.
- La rotación consume la sesión con una actualización atómica y rechaza la reutilización del token anterior (`SESSION_REVOKED`). Logout y cambio de contraseña mantienen la revocación global por `tokenVersion`.
- Core: agregado GET/PATCH `/companies/me/settings` para `locale`, `dateFormat` y `fiscalYearStartMonth`, con validación estricta, permisos RBAC y tenant derivado del token.
- Aumentado el timeout de Jest a 30 segundos; el hook de producción podía superar 15 segundos bajo carga en Windows, aunque la suite aislada pasara.
- QA local: 19/19 suites unitarias (267 pruebas) y 9/9 suites de integración (182 pruebas) aprobadas con MongoDB efímero; 449/449 pruebas en total. Incluye replay de refresh e aislamiento/permisos de settings.

Formato: [Keep a Changelog](https://keepachangelog.com/). Todo cambio relevante se registra aquí (control de cambios, § reglas del prompt).

## [0.1.0] — 2026-09-21

### FASE 1 — Backend base
- Arquitectura por capas: Routes → Controller → Service → Repository → MongoDB (sin lógica de negocio en controllers).
- API REST versionada en `/api/v1`, respuestas `{ success, data, meta? }` / `{ success:false, error:{ code, message, details? } }`.
- Errores globales amigables (sin stack traces, tokens ni contraseñas): `error.middleware.js` + `errorTranslator.js`.
- Validación de todo input con Zod (`validate`) + `preventUnknownFields` (mas assignment).
- Seguridad: helmet, CORS por orígenes, rate limit (login estricto), `.env` único para secretos, logger con redacción.
- `BaseRepository` con guardia multiempresa: una query sin `companyId` falla ruidosamente (ADR-004).

### FASE 2 — Core
- **Auth**: login (anti-fuerza bruta: 5 intentos → bloqueo; anti-enumeración: mensaje único), refresh, logout global (`tokenVersion++`), `/me`, cambio de contraseña.
- **Companies**: alta por plataforma con aprovisionamiento (sucursal MAIN + 10 roles semilla) y rollback; suspensión lógica bloquea el login de la empresa.
- **Branches**: CRUD con código único POR empresa; guardas de sucursal predeterminada/en uso.
- **Roles**: CRUD de roles propios, catálogo de permisos expuesto, roles de sistema inmutables, en uso → 409.
- **Users**: CRUD con anti-escalada de privilegios, auto-protección (no cambias tu rol/estado), protección del último administrador, borrado lógico con revocación de sesiones.
- **Audit**: bitácora inmutable (sólo lectura vía API), TTL configurable por `expiresAt`, auditoría de plataforma (`companyId: null`).
- RBAC granular `modulo.recurso.accion` con catálogo en código (ADR-002).
- Semilla idempotente (`npm run seed [-- --demo]`) e script de índices (`npm run indexes`).
- QA: 8 suites unitarias + 3 de integración (auth, multiempresa/permisos, companies) + matriz en `docs/qa/matriz-pruebas.md`.

### FASE 3 — Inventario
- **Products**: catálogo con SKU único **por empresa** (mayúsculas), status `active|inactive`; guardas de borrado (con existencias o movimientos ⇒ 409, desactivar en su lugar).
- **Warehouses**: almacenes con código único por empresa, `branchId` opcional, almacén `MAIN` aprovisionado en cada alta de empresa (con rollback) y en la semilla demo.
- **Stock (`stock_levels`)**: fila única `{companyId, warehouseId, productId}` con invariante `quantity >= 0`; operaciones atómicas `increment` / `decrementConditional` / `setExact` / `createIfAbsent` (ADR-008).
- **Movimientos (`inventory_movements`)**: ENTRY/EXIT/ADJUSTMENT/TRANSFER con `quantityBefore/After`; **append-only** (sin PATCH/DELETE en la API); auditoría con `resourceId` vía `req.auditResourceId`.
- **Reglas**: salidas y origen de transferencia con decremento condicional ⇒ 409 `Stock insuficiente en el almacén indicado.`; ajuste = recuento absoluto optimista con `reason` obligatorio ⇒ 409 de reintento ante carrera; transferencia exige origen≠destino (422); compensación inversa si falla la creación del movimiento.
- **Guardas de sucursal (FASE 3)**: no se elimina una sucursal con almacenes con existencias (409); al eliminarse, sus almacenes se desvinculan (`branchId: null`) sin borrarlos.
- **RBAC**: grupos `products.*`, `warehouses.*`, `inventory.*` (`inventory.read`, `inventory.movements.create`, `inventory.adjustments.create`, `inventory.transfers.create`); `warehouses.read` sólo a gerente/almacen/auditor/consulta; movimientos SÓLO admin y almacén.
- QA: 2 suites unitarias nuevas (validación de inventario, reglas de stock con mocks) + 1 de integración (recorrido API completo) + extensiones de `permissions` y `companies`.

### FASE 4 — Compras/Ventas
- **Suppliers / Customers**: CRUD con código único **por empresa** (mayúsculas), status `active|inactive`; guardas de borrado (con órdenes/pedidos ⇒ 409, desactivar en su lugar).
- **Purchase/Sales Orders**: documentos `PO-000001…`/`SO-000001…` con numeración secuencial **atómica por empresa** (colección `counters`, `$inc` upsert, ADR-009); `total` calculado siempre por el servidor; flujo `DRAFT → APPROVED | REJECTED` — edición sólo en borrador, **sin DELETE** (se rechaza con motivo), ADR-010.
- **Aprobación con asiento de inventario**: aprobar compra genera una ENTRADA por línea; aprobar venta genera una SALIDA por línea con decremento condicional (sin stock ⇒ 409 canónico `Stock insuficiente en el almacén indicado.` y el documento **permanece en DRAFT**); si una línea posterior falla, las ya aplicadas se **compensan** antes de re-lanzar (patrón ADR-008). Los movimientos referencian el código del documento para trazabilidad.
- **RBAC FASE 4**: `gerente` gana `purchases.approve` y `sales.orders.approve` (aprueba/rechaza junto con administrador); compras crea órdenes pero no aprueba; ventas crea pedidos pero no aprueba.
- QA: 2 suites unitarias nuevas (validación de documentos/líneas, reglas de aprobación con compensaciones mockeadas) + 1 de integración (flujo completo compras→stock→ventas con RBAC, 404 multiempresa, guardas y auditoría) + extensión de `permissions`.

### FASE 5 — Finanzas y reportes
- **Accounts**: cuentas `bank|cash|wallet` con código único por empresa; `balance` **sólo servidor** (escritura optimista condicionada al saldo leído, ADR-011); con movimientos ⇒ no se borra (409, desactivar en su lugar).
- **Incomes / Expenses**: `INC-000001…`/`EXP-000001…` con contador atómico por empresa (un fallo deja un hueco: el contador no se rebobina); **append-only** — crear/leer/ANULAR (`POST /:id/void` con `reason`; `PATCH`/`DELETE` ⇒ 404); la anulación invierte el saldo, incluso si deja la cuenta en negativo o la cuenta está inactiva (corrección contable, ADR-011); doble anulación ⇒ 409 vía marcado condicional `POSTED→VOID`.
- **Reglas de saldo**: los débitos exigen saldo suficiente ⇒ 409 `Saldo insuficiente en la cuenta indicado.` (`details.available`) y el documento creado se **compensa** (borrado, mejor esfuerzo con log); carrera de saldo ⇒ 409 `El saldo cambió durante la operación. Intente de nuevo.` (3 reintentos); abonos siempre permitidos (recuperación de cuentas en negativo); cuenta inactiva ⇒ 409.
- **Budgets**: clave única `(empresa, año, mes, categoría)` ⇒ 409 canónico con los tres campos; guardan sólo lo planeado; el ejecutado se calcula al vuelo.
- **Reports**: `/reports/kpis|sales|purchases|inventory|finance|budgets` (agregaciones acotadas por `companyId`) + `/reports/finance/export` CSV con BOM UTF-8 y escapado RFC 4180; validaciones estrictas de rango y `year` obligatorio en presupuestos.
- **RBAC FASE 5**: grupo `finance.*` ampliado con `.void` y CRUD de cuentas/presupuestos; el dinero lo gestionan sólo `administrador` y `finanzas` (gerente/auditor leen); `reports.export` sólo admin/finanzas/gerente/auditor.
- **Semilla**: cuentas demo `DEMO-CASH` y `DEMO-BANK` con `--demo`.
- QA: 2 suites unitarias nuevas (validación de finanzas/reportes, reglas de saldo/anulación con mocks) + 2 de integración (API financiera con RBAC/404/compensaciones/auditoría; reportes con datos sembrados, validaciones 422 y CSV) + extensión de `permissions` (filas #20–#24 de la matriz).

### FASE 6 — CRM, RRHH y Producción
- **Leads (CRM)**: `/crm/leads` con ciclo de vida `NEW → CONTACTED → QUALIFIED → WON | LOST` (transiciones inválidas ⇒ 409; estado terminal cerrado ⇒ 409); **sin DELETE** — la baja es por estado (ADR-012); `assignedTo` validado contra la empresa (ajeno ⇒ 404).
- **Employees (RRHH)**: `/hr/employees` con `documentId` (documento de identidad) único **por empresa** ⇒ 409 canónico con `details.fields`; baja/reactivación por `status inactive|active`; **sin DELETE**.
- **BOM**: `/production/boms` con código `BOM-000001…` (contador atómico por empresa, ADR-009); producto terminado y componentes deben existir y estar activos; autoreferencia o componente repetido ⇒ 422; lifecycle `active|inactive` (una BOM inactiva no admite OT).
- **Órdenes de producción**: `/production/orders` con código `MO-000001…` y flujo `DRAFT → RELEASED → DONE | CANCELLED` (ADR-013): **release** = snapshot de componentes de la BOM escalados por `quantity` + una SALIDA por componente (fallo en una línea ⇒ devolución de las anteriores y la OT **sigue en DRAFT**; carrera ⇒ 409 con devolución total); **done** = ENTRADA del producto terminado (carrera ⇒ re-extracción); **cancel** = desde DRAFT sólo cambia el estado, desde RELEASED devuelve el material y exige `reason`; edición sólo en DRAFT; **sin DELETE**.
- **RBAC FASE 6**: los grupos `crm.*`, `hr.*`, `production.*` sólo tienen `read|create|update` (sin `.delete`, ADR-012); ventas administra CRM, rrhh administra empleados, produccion opera BOM/OT (con `production.update` sobre release/done/cancel); gerente lee CRM/RRHH pero **no** producción; auditor/consulta no entran a estos módulos.
- **Defecto corregido (barrido estático FASE 6)**: `accounts/account.service.js` tenía el `require` de `expense.repository` **sin cerrar el paréntesis** (error de sintaxis que impediría arrancar la API); corregido. Sin test nuevo posible hasta que haya Node (revisar `npm run test:unit` al ejecutar la matriz).
- **Semilla**: datos demo FASE 6 (producto terminado `DEMO-002`, BOM, empleado y lead) con `--demo`.
- QA: 4 suites unitarias nuevas (validación CRM/RRHH, reglas CRM/RRHH, validación de producción, reglas de producción con mocks) + 2 de integración (API CRM/RRHH con ciclo de vida y RBAC; API de producción con flujo completo release→done/cancel, compensaciones de stock y auditoría) + extensión de `permissions` (filas #25–#31 de la matriz).

### FASE 7 — Frontend de módulos (RN + RN Web)
- **Shell completo**: `App.js` monta `AuthProvider → RouterProvider → Layout → SCREENS`; router propio por estado (`nav/RouterContext`, sin React Navigation ni librerías extra); `Layout` con cabecera (empresa/rol/sucursal/salir) y menú lateral **filtrado por permisos** (`can()` desde `session.role.permissions`), tira horizontal en pantallas angostas.
- **22 pantallas**: inventario (productos, almacenes, existencias, movimientos con los 4 tipos y sus permisos diferenciados), compras/ventas (proveedores, clientes, órdenes/pedidos con editor de líneas, ciclo `DRAFT → APPROVED | REJECTED`, aprobación/rechazo con motivo y **sin DELETE**), finanzas (cuentas con saldo sólo-lectura, ingresos/gastos append-only con anulación, presupuestos, reportes con 6 pestañas + export CSV), CRM/RRHH/producción (leads con transiciones de estado, empleados con baja por estado, BOM, OT con release/done/cancel), configuración (usuarios, roles con editor de permisos agrupados, sucursales, auditoría inmutable) y Home con KPI y accesos por permiso.
- **Componentes genéricos reutilizables**: `DataTable` (paginado, búsqueda, acciones por fila), `FormModal` (texto/número/select/checkbox/fecha/líneas/chips de permisos; select vacío ⇒ campo omitido; required vacío ⇒ validación local en español), `Dropdown`, `useConfirm` (RN Web no implementa `Alert.alert`; los errores canónicos del backend se muestran en diálogo, la promesa nunca queda silenciada), `DetailModal`, `StatusBadge`; hooks `useList`/`usePicklist`.
- **Cliente API**: `withMeta` (lee `meta.total`) y `apiText` (descarga CSV con la misma renovación de token que `api()`).
- **QA de compilación (export web)**: el primer barrido detectó y se corrigieron (1) el módulo `src/lib/format.js` **no existía** (importado por 14 pantallas; creado con `money/dateOf/labelFor/invert`) y (2) cuatro pantallas usaban `<Text>` sin importarlo (`Accounts`, `Budgets`, `Incomes`, `Expenses`). Se añadieron verificaciones estáticas: imports de `react-native` por archivo, resolución de todos los imports relativos y coherencia `MENU` ↔ `SCREENS` ↔ `export default` (todo ✅). Segundo barrido: **export OK — 243 módulos, bundle 496 kB, exit 0**.\n- **QA (primera ejecución real)**: Node.js v24.19.0 instalado; `npm run test:unit` → **18/18 suites · 264/264 pruebas ✅** (cobertura unitaria de `src/`: 54 %; sube con las integraciones, hoy en pausa por `MONGO_URI_TEST`).
- **5 defectos de backend detectados por la matriz y corregidos**: (1) `tenantFilter` dejaba que `extra.companyId` pisara el del token (aislamiento multiempresa, fila #3); (2) `budgetService.create` enviaba campos no-clave a `findByKey` (fila #21); (3) `auditService.log` persistía `before: undefined` en vez de `null` (fila #8); (4) `isDuplicateKeyError(null)` devolvía `null` en vez de `false` (fila #5); (5) `parsePagination` trataba `limit='0'` como ausente ⇒ 20 en vez de 1 (fila #2). Todos cubiertos por sus tests.
- **Reordenamiento de fases (decisión del usuario)**: FASE 7 = Frontend de módulos, FASE 8 = IA, FASE 9 = Integraciones.

### Pendiente / known issues
- **QA backend**: unitarias ✅ (264/264); API/integración (#9–#11, #14, #18, #22, #23, #29, #30) pendientes de `$env:MONGO_URI_TEST` con una BD de test descartable.
- **QA frontend**: exportación web (`npx expo export --platform web`) como barrido de compilación de las 22 pantallas; prueba visual manual pendiente con `npm run web:frontend`.
- **Migración FASE 4**: el rol `gerente` de empresas ya sembradas no tiene `purchases.approve` / `sales.orders.approve` (la semilla no edita roles existentes). Actualizar esos dos permisos en BD o recrear la empresa demo.
- **Migración FASE 5**: el rol `finanzas` de empresas ya sembradas no tiene los permisos nuevos (`finance.income.void`, `finance.expenses.void`, `finance.accounts.create/update/delete`, `finance.budgets.create/delete`). Actualizar el arreglo `permissions` del rol en BD o recrear la empresa demo.
- **Migración FASE 6**: si una empresa se sembró antes de incorporar los grupos `crm.*`/`hr.*`/`production.*` al catálogo, sus roles (incluido `administrador`, que se sembró con el catálogo vigente de ese momento) carecen de esos permisos. Refrescar los arreglos `permissions` de los roles en BD (usar `DEFAULT_ROLES` actual como fuente) o recrear la empresa demo.
- El prompt maestro (43 secciones) debe guardarse en `docs/requirements/` desde la conversación original.

## Security audit - 2026-09-23
- `.env.example` contained a MongoDB URI with apparent credentials and used `MONGODB_URI`, not the backend-required `MONGO_URI`. Removed credential assignments and added a placeholder URI with the correct name. QA: 18/18 unit suites (264 tests) and 9/9 integration suites (181 tests) passed; line coverage is 87.97% (above the 80% target). Atlas credential rotation and history cleanup decision remain pending.


## Security audit follow-up - 2026-09-24
- Reescrita la historia de la rama publica `main`; verificado que su historial actual no conserva las asignaciones MongoDB expuestas. La clave aun requiere revocacion en Atlas.
- Export web validado: 240 modulos, bundle 496 kB. La revision visual queda bloqueada por falta de navegador automatizable.
- Actualizados el estado de arquitectura, README y matriz QA con resultados y pendientes actuales.
