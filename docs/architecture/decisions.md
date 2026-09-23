# Decisiones de arquitectura (ADR)

Formato: Contexto → Decisión → Consecuencias. Estado: Aceptado.

---

## ADR-001 — Stack único para web y móvil

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: el proyecto exige React Native + React Native Web, Node.js/Express y MongoDB Atlas; Kotlin sólo para funciones nativas puntuales de Android.
- **Decisión**: Expo como toolchain (un solo codebase → iOS/Android/Web), Express en capas, Mongoose, Zod para validación.
- **Consecuencias**: un solo equipo/un solo lenguaje; las libs nativas puntuales se integran con módulos expo/config-plugins en fases futuras.

## ADR-002 — Catálogo de permisos en código, roles en BD

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: RBAC granular (`modulo.recurso.accion`); el catálogo no debe poder corromperse desde la UI.
- **Decisión**: el catálogo vive en `backend/src/config/permissions.js` (versionado con git, revisable en PR). Los **roles** (colección `roles`) guardan códigos de ese catálogo. El backend valida cada permiso recibido contra el catálogo (422 si es desconocido).
- **Consecuencias**: añadir un permiso exige código + PR; añadir un rol es operación de datos sin deploy.

## ADR-003 — Sesiones JWT con `tokenVersion` (sin lista negra)

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: logout y revocación sin colección de tokens en BD.
- **Decisión**: access token corto (15m, payload `sub/companyId/branchId/roleId/tv`) + refresh minimalista (`sub/tv`, 7d). El usuario tiene `tokenVersion`: incrementarla invalida **todos** los refresh emitidos (logout global, cambio de contraseña, cambio de rol/estado). `authenticate` compara `tv` del token con el usuario en cada request.
- **Consecuencias**: revocación en ≤15 min incluso para access tokens vivos; sin tablas de blacklist; un refresh robado sirve sólo hasta el próximo logout/cambio.

## ADR-004 — `BaseRepository` con guardia de tenant

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: "un usuario jamás accede a datos de otra empresa aunque manipule IDs en la URL".
- **Decisión**: repositorios de negocio (`requireTenant: true`) **lanzan** si alguna query carece de `companyId` — falla en desarrollo/tests, nunca consulta desfiltrada en producción. El `companyId` se inyecta desde el token (`tenantFilter`), nunca desde el cliente. Entidades de plataforma (`companies`, `roles`, `users`) usan `requireTenant: false` con el scope impuesto explícitamente en el service.
- **Consecuencias**: olvidar el filtro = error inmediato (ruidoso), no una fuga silenciosa; `assertOwnership` añade la defensa IDOR en rutas con `:id` (404, no 403).

## ADR-005 — Auditoría no bloqueante

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: la bitácora es crítica, pero un fallo de Mongo no debe romper la operación del usuario.
- **Decisión**: `auditService.log()` nunca lanza: si falla, se registra en logs internos y la operación continúa. El middleware global intercepta `res.json` de mutaciones y guarda `before`/`after` (con redacción de secretos). `logOrFail()` queda reservado para operaciones futuras con transacciones.
- **Consecuencias**: disponibilidad > registro perfecto; el riesgo (pérdida de un entry en incidente de BD) queda documentado y monitorizable vía logs.

## ADR-006 — Borrado lógico en usuarios y empresas

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: la auditoría y la integridad impiden destruir historial; los ERP requieren reactivación.
- **Decisión**: `DELETE /users/:id` ⇒ `status: 'inactive'` + `tokenVersion++` (sesiones cerradas). `DELETE /companies/:id` ⇒ `status: 'suspended'` (sólo plataforma; el login de esa empresa queda bloqueado). Sucursales y roles propios sí se borran físicamente, con guardas (en uso, predeterminado, último admin).
- **Consecuencias**: nada crítico se pierde; la purga física de empresas es un proceso batch futuro documentado.

## ADR-007 — Roles semilla por empresa y roles de sistema inmutables

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: cada empresa necesita un RBAC operativo desde el alta.
- **Decisión**: crear una empresa aprovisiona sucursal `MAIN` + almacén `MAIN` (FASE 3) + 10 roles (`administrador, gerente, ventas, compras, almacen, finanzas, rrhh, produccion, auditor, consulta`) con `isSystem: true` (no editables ni eliminables vía API). Si el aprovisionamiento falla, se revierte la creación de la empresa (mejor esfuerzo). El Super Admin (`super_admin`, `companyId: null`) sólo existe a nivel de plataforma, creado por semilla.
- **Consecuencias**: los usuarios no arrancan sin rol; personalizar permisos exige crear un rol nuevo (recomendado) en lugar de tocar los de sistema.

## ADR-008 — Stock atómico con decremento condicional y movimientos inmutables

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: MongoDB (Atlas) sin transacciones multi-documento en el plan gratuito; dos salidas simultáneas no deben dejar `quantity < 0` ni perder un movimiento de inventario.
- **Decisión**:
  - `stock_levels` guarda una fila única `{companyId, warehouseId, productId}` con invariante `quantity >= 0`.
  - **Salidas y origen de transferencia** usan `findOneAndUpdate` con condición `quantity: { $gte: n }` (decremento condicional atómico): si no alcanza ⇒ `null` ⇒ 409 "Stock insuficiente en el almacén indicado.". Sólo una de dos peticiones simultáneas gana.
  - **Ajustes** = recuento absoluto con condición de valor esperado (optimista, `setExact`): si el stock cambió entre lectura y escritura ⇒ `null` ⇒ 409 "El stock cambió durante la operación. Intente de nuevo." y el cliente reintenta.
  - Si la creación del **movimiento** falla tras mutar stock, se aplica la **compensación inversa** (mejor esfuerzo + log): así el invariante se mantiene aunque no haya transacción multi-doc.
  - `inventory_movements` es **append-only**: la API no expone PATCH/DELETE; `quantityBefore/quantityAfter` permiten reconstruir el saldo.
- **Consecuencias**: no se pierden movimientos ni queda stock negativo bajo concurrencia; ante un fallo crítico entre stock y movimiento la compensación es mejor-esfuerzo (auditado en logs), acceptable mientras no se usen transacciones de replica set.

## ADR-009 — Códigos secuenciales por empresa con contador atómico

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: los documentos de negocio (órdenes de compra, pedidos de venta) necesitan un código humano (`PO-000001`) único **por empresa**; `countDocuments + 1` es una carrera clásica sin transacciones.
- **Decisión**: colección `counters` `{companyId, key, seq}` con `findOneAndUpdate({$inc}, {upsert, new})` — el incremento es atómico en un solo documento. Guard ruido: `nextSequence` lanza si falta `companyId` (misma filosofía que `BaseRepository`, ADR-004). El índice único `{companyId, code}` respalda la unicidad.
- **Consecuencias**: nunca se repite un código aunque haya peticiones concurrentes; pueden quedar huecos si una creación falla tras consumir el número (aceptable: el código identifica, no tiene huecos garantizados).

## ADR-010 — Documentos comerciales: DRAFT → APPROVED | REJECTED con asiento de inventario

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: compras y ventas deben descontar/aparecer en el inventario de forma consistente con ADR-008 (sin transacciones multi-documento).
- **Decisión**:
  - Estados mínimos: `DRAFT`, `APPROVED`, `REJECTED`. Sólo se crea/edita en `DRAFT`; **no hay DELETE** de documentos (se rechaza con motivo). Rechazar no toca inventario.
  - **Aprobar una orden de compra** genera una ENTRADA por línea en su almacén; **aprobar un pedido de venta** genera una SALIDA por línea con decremento condicional (si no alcanza ⇒ 409 canónico y el pedido permanece en `DRAFT`).
  - Si una línea posterior falla, las líneas ya aplicadas se **compensan** (salidas inversas para compras, entradas inversas para ventas) antes de re-lanzar el error: el estado sólo cambia a `APPROVED` cuando todo el asiento quedó aplicado.
  - Los movimientos generados usan `reason`/`reference` con el código del documento (`PO-000001`) para trazabilidad compras ⇄ inventario.
  - `total` lo calcula SIEMPRE el servidor; `status`, `code`, `companyId`, `approvedBy/at` no aceptan cliente (`preventUnknownFields` + Zod estricto).
  - RBAC: crean/median `purchases.create|update` (compras) y `sales.orders.create|update` (ventas); **aprueban/rechazan** `purchases.approve` / `sales.orders.approve` (administrador y gerente).
- **Consecuencias**: el inventario y los documentos nunca quedan a medias; el "recibir/despachar" por separado queda pendiente para una fase futura si se requiere desacoplar aprobación de recepción.

## ADR-011 — Finanzas: movimientos append-only y saldos condicionados

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: FASE 5 necesita ingresos, gastos, cuentas y presupuestos con las mismas garantías de multiempresa y consistencia que inventario (ADR-008), sin transacciones multi-documento.
- **Decisión**:
  - **Ingresos/gastos son APPEND-ONLY**: se crean, se leen y se ANULAN (`POST /:id/void` con `reason` obligatorio); la API no expone `PATCH`/`DELETE` (404). Los códigos `INC-000001…`/`EXP-000001…` salen del contador atómico por empresa (ADR-009): un fallo posterior deja un **hueco** (el contador no se rebobina).
  - **Saldo de cuentas**: `balance` sólo lo escribe el servidor vía `applyMovement`: escritura **optimista condicionada al saldo leído** (3 reintentos ⇒ 409 `El saldo cambió durante la operación. Intente de nuevo.`). Los **débitos** no pueden dejar la cuenta en negativo (409 `Saldo insuficiente en la cuenta indicado.` con `details.available`); los **abonos siempre se permiten** (así se recuperan cuentas en negativo). El cliente nunca envía `balance`.
  - **Compensaciones**: crear = documento primero y saldo después; si el saldo falla se **borra** el documento (mejor esfuerzo + log). Anular = marcado **condicional** `POSTED→VOID` (la carrera la pierde el segundo ⇒ 409 `El registro ya fue anulado.`) y luego la inversión del saldo; si invertir falla se revierte el marcado.
  - **La anulación invierte el movimiento aunque deje saldo negativo o la cuenta esté inactiva**: es una corrección contable, no un movimiento nuevo.
  - **Cuentas**: `code` único por empresa (mayúsculas); con movimientos ⇒ no se borra (409, desactivar en su lugar).
  - **Presupuestos**: clave única `(companyId, año, mes, categoría)`; guardan sólo lo planeado; lo ejecutado se calcula al vuelo en `/reports/budgets` (vista mensual por fila; vista anual agregada por categoría).
  - **Reportes**: sólo lectura, agregaciones siempre acotadas por `companyId` (`reports.read`; export CSV con `reports.export`); CSV con BOM UTF-8 y escapado RFC 4180.
  - RBAC (catálogo en código, ADR-002): el dinero lo gestionan `administrador` y `finanzas`; `gerente`/`auditor` sólo leen; nuevas acciones `.void` y CRUD de cuentas/presupuestos.
- **Consecuencias**: no hay edición "a mano" de un asiento (se anula y se vuelve a crear), conservando la trazabilidad; los huecos de numeración son aceptados; el saldo no se desincroniza de los movimientos porque ambas operaciones se compensan.

## ADR-012 — Módulos FASE 6 sin `.delete`: el ciclo de vida es el estado

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: CRM, RRHH y Producción necesitan "dar de baja" registros sin perder trazabilidad; el catálogo de permisos FASE 6 (`crm.*`, `hr.*`, `production.*`) declara sólo `read|create|update`, sin `.delete`.
- **Decisión**:
  - **Ninguna ruta `DELETE`** en `/crm/leads`, `/hr/employees`, `/production/boms` ni `/production/orders`: la ruta no existe ⇒ 404 (igual que el append-only de ADR-011).
  - **Leads**: baja = transición a estado terminal del ciclo `NEW → CONTACTED → QUALIFIED → WON | LOST`. Transiciones fuera del mapa ⇒ 409 `La transición de estado no está permitida.`; un lead `WON/LOST` es cerrado y no admite modificaciones ⇒ 409.
  - **Empleados**: baja = `status: inactive` (y reactivación a `active`); `documentId` único **por empresa** ⇒ 409 `Ya existe un registro con ese valor en: documentId.` con `details.fields`.
  - **BOM**: `status: active|inactive`; una BOM inactiva no admite nuevas órdenes de producción (409).
  - **Órdenes de producción**: la baja documental es `CANCELLED` (ver ADR-013).
- **Consecuencias**: el histórico nunca se destruye y la auditoría siempre tiene el documento completo; "eliminar" en la UI debe traducirse a la transición de estado correspondiente; añadir un `.delete` futuro exige ampliar el catálogo en código (ADR-002).

## ADR-013 — Orden de producción: DRAFT → RELEASED → DONE | CANCELLED con asiento de inventario

- **Fecha**: 2026-09-21 · **Estado**: Aceptado
- **Contexto**: producir consume componentes y genera producto terminado; debe ser consistente con ADR-008 (sin transacciones multi-documento) y usar el contador `MO-000001…` (ADR-009).
- **Decisión**:
  - Estados: `DRAFT → RELEASED → DONE | CANCELLED`. Sólo se crea/edita en `DRAFT` (409 `Sólo los documentos en borrador pueden modificarse.`); **sin DELETE** (ADR-012).
  - **RELEASE** (`POST /:id/release`, cuerpo vacío): revalida BOM activa, almacén activo y producto final; **copia (snapshot) los componentes de la BOM escalados por `quantity`** en `lines` (redondeo a 4 decimales) y ejecuta una **SALIDA** por componente. Si una línea posterior falla (409 `Stock insuficiente en el almacén indicado.`), las ya extraídas se **devuelven** (entrada compensatoria) y la OT permanece en `DRAFT`. El marcado `DRAFT→RELEASED` es **condicional**: si pierde la carrera ⇒ 409 y se devuelve todo el material.
  - **DONE** (`POST /:id/done`): genera la **ENTRADA** del producto terminado (`quantity`) en `warehouseId`; si el marcado `RELEASED→DONE` falla tras la entrada, se extrae de vuelta (compensación). Sólo desde `RELEASED` (DRAFT ⇒ 409 `La orden debe estar liberada antes de finalizarse.`).
  - **CANCELLED** (`POST /:id/cancel`, `reason` obligatorio): desde `DRAFT` sólo cambia el estado; desde `RELEASED` **devuelve los componentes** (entradas) antes del marcado condicional `DRAFT|RELEASED→CANCELLED`; si devolver falla ⇒ compensación (re-extracción) y la OT no se cancela; si el marcado falla tras devolver ⇒ se re-extrae todo y 409.
  - Los asientos usan `reason`/`reference` con el código `MO-000001` (trazabilidad OT ⇄ inventario).
  - RBAC: `production.create` (alta de BOM/OT), `production.update` (edición, release, done y cancel), `production.read`; operador = rol `produccion`.
- **Consecuencias**: el inventario y la OT nunca quedan a medias bajo carrera o fallo parcial (todo-aplicado o compensado); un release fallido devuelve el material y deja la OT editable en `DRAFT`; cancelar una OT liberada devuelve el material en lugar de perderlo.
