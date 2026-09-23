# Matriz de pruebas QA (FASE 2 + 3 + 4 + 5 + 6)

**Estado global (2026-09-23; suite completa con cobertura)**:
- **Unitarias: APROBADO**: 18/18 suites y 264/264 pruebas aprobadas.
- **API + integracion: APROBADO**: 9/9 suites, 181/181 pruebas aprobadas con mongodb-memory-server efimero.
- **Cobertura total**: lineas 87.97% (2902/3299), supera el objetivo >=80%; ramas 40.37% (631/1563).
- **FASE 7 (frontend) ✅**: `expo export --platform web` → **exit 0, 243 módulos, bundle 496 kB**; verificaciones estáticas ✅ (imports de `react-native` por archivo, resolución de todos los imports relativos, coherencia `MENU`↔`SCREENS`↔`export default`). Defectos detectados y corregidos en el QA: módulo `src/lib/format.js` inexistente (14 pantallas lo importan) y `<Text>` sin importar en `Accounts/Budgets/Incomes/Expenses`. Prueba visual manual pendiente (`npm run web:frontend` o `http://localhost:8086` sobre `dist/`).
- Ejecución que detectó 5 defectos de backend (ya corregidos, ver `docs/CHANGELOG.md`): `tenantFilter` podía ser pisado por `extra.companyId`, `budgetService.create` pasaba campos no-clave a `findByKey`, `auditService` persistía `before: undefined`, `isDuplicateKeyError(null)` devolvía `null`, `parsePagination` trataba `limit='0'` como ausente.

## Cómo ejecutar

```powershell
npm --prefix backend install    # (si no existe node_modules)

# Unitarias (sin base de datos) — ✅ ejecutadas
npm run test:unit

# Integracion (MongoDB efimero automatico; opcional MONGO_URI_TEST externo y descartable)
$env:MONGO_URI_TEST="mongodb+srv://USER:PASS@cluster/erp_test?retryWrites=true&w=majority"
npm run test:integration     # o npm test (todo en serie)

# Cobertura
cd backend ; npx jest --coverage
```

> Las integraciones se omiten solas si `MONGO_URI_TEST` no está definida. `npm test` usa `--runInBand`: los archivos comparten la BD de test en serie (cada uno la limpia en `beforeAll`).

## Matriz

| # | Módulo | Tipo de prueba | Archivo | Cubre | Ejecución |
|---|---|---|---|---|---|
| 1 | Permisos/RBAC | Unitaria | `tests/unit/permissions.test.js` | catálogo sin duplicados y con formato, coherencia PERMISSIONS↔ALL, roles semilla válidos, `administrador` sin `companies.create/delete`, rol consulta solo-lectura, roles sin escalada | ✅ |
| 2 | Paginación | Unitaria | `tests/unit/pagination.test.js` | defaults, límites, skip, whitelist de `sortBy` (anti-inyección), `buildMeta` | ✅ |
| 3 | Multiempresa | Unitaria | `tests/unit/tenant.test.js` | `tenantFilter` inyecta companyId del token y no deja pisarlo, 403 sin tenant, Super Admin `allCompanies`; `assertOwnership` → 404 entre tenants | ✅ |
| 4 | Multiempresa | Unitaria | `tests/unit/base-repository.test.js` | guard: query sin `companyId` falla **antes** de Mongo; filtro `{_id, companyId}`; ObjectId inválido → null sin consultar | ✅ |
| 5 | Errores | Unitaria | `tests/unit/error-translator.test.js` | 11000 → 409 con campos, ValidationError → 422 legible, re-lanzado de errores normales | ✅ |
| 6 | Seguridad | Unitaria | `tests/unit/password.test.js` | hash no reversible, compare, salt único, política de fortaleza | ✅ |
| 7 | Seguridad | Unitaria | `tests/unit/tokens.test.js` | payloads (access completo / refresh mínimo), secreto ajeno → inválido, payload alterado → inválido, expirado → `TOKEN_EXPIRED` | ✅ |
| 8 | Auditoría | Unitaria | `tests/unit/audit-service.test.js` | redacción de `password/token/secret` (recursiva), `log()` jamás lanza (ADR-005), `logOrFail()` sí propaga | ✅ |
| 9 | Auth | API + integración | `tests/integration/auth.test.js` | login ok/ko, anti-enumeración (mismo mensaje), validación 422/strict, bloqueo a los 5 intentos, `/me`, refresh+logout global (`TOKEN_REVOKED`), refresh ajeno → 401, cambio de contraseña (valida actual, cierra sesiones, clave vieja muere), logins en auditoría sin contraseñas | APROBADO |
| 10 | Multiempresa + permisos | API + integración | `tests/integration/multiempresa.test.js` | listados aislados por tenant, ID ajeno en URL → 404 (users/roles/branches/companies), código de sucursal único **por empresa**, auditoría sin entries ajenos, 403 con mensaje canónico `Se requiere: users.read`, ventas sin acceso a sucursales/roles/auditoría, 401 sin token, anti-escalada (`companies.create`), permiso inventado → 422, rol de otra empresa → 422, roles de sistema 409, rol en uso 409, autodelete 409, empresas sólo-plataforma, admin edita su empresa pero no la suspende, cambio de contraseña por admin | APROBADO |
| 11 | Companies | API + integración | `tests/integration/companies.test.js` | 401 sin token, alta con aprovisionamiento (MAIN + **almacén MAIN** + 10 roles `isSystem`), duplicado → 409 canónico, listado/detalle Super Admin, alta de admin en empresa nueva, último administrador protegido (409), suspensión lógica + login `COMPANY_SUSPENDED`, auditoría de plataforma | APROBADO |
| 12 | Inventario | Unitaria | `tests/unit/inventory-validation.test.js` | quantity > 0, ObjectId inválido, schema estricto (inyección de `companyId`), `reason` obligatorio en ajuste (y quantity 0 permitida), transferencia origen≠destino (`path: toWarehouseId`), enum de `type`, fechas coercidas, `limit ≤ 100` | ✅ |
| 13 | Inventario | Unitaria | `tests/unit/stock-rules.test.js` | guardia tenant del repo de stock; `decrementConditional` con `quantity:{$gte}` y `$inc` negativo (null ⇒ insuficiente); `setExact` optimista; `increment` upsert; `createIfAbsent` absorbe 11000; service: 409 canónico por stock insuficiente/carrera, 404 entre tenants, 409 producto inactivo, 422 origen=destino, **compensaciones inversas** si falla el movimiento (entrada/salida/ajuste/transferencia) | ✅ |
| 14 | Inventario | API + integración | `tests/integration/inventory.test.js` | 401; 403 canónico (`products.create`, `inventory.movements.create`); SKU/code únicos por empresa (409 canónico); inyección `companyId` → 400; almacén ajeno → 404; stock hidratado; salida > stock → 409 con `available`; ajuste con motivo (422 sin reason); transferencia y origen=destino (422); movimientos inmutables (PATCH/DELETE → 404); listados aislados + IDs ajenos → 404; guardas producto/almacén/sucursal (409) y desvinculación de almacenes al borrar sucursal; auditoría `POST_INVENTORY` con `resourceId` | APROBADO |
| 15 | Permisos/Inventario | Unitaria | `tests/unit/permissions.test.js` (extensión FASE 3) | grupos PRODUCTS/WAREHOUSES/INVENTORY completos; admin cubre inventario; `warehouses.read` sólo gerente/almacen/auditor/consulta; movimientos sólo admin+almacén; nadie más crea productos | ✅ |
| 16 | Compras/Ventas | Unitaria | `tests/unit/orders-validation.test.js` | líneas mínimas 1, `quantity > 0`, `unitCost/unitPrice ≥ 0`, líneas estrictas (sin `companyId`), `warehouseId` opcional ObjectId, `status/companyId/total/code` fuera de `CREATE_FIELDS`, `approve` cuerpo sólo `{}`, `reject` exige `reason`, enums de listado, schemas de proveedor/cliente | ✅ |
| 17 | Compras/Ventas | Unitaria | `tests/unit/orders-rules.test.js` | creación DRAFT con código secuencial y total del servidor; proveedor/cliente/producto ajeno → 404 (sin consumir numeración); inactivos → 409; edición sólo en DRAFT; aprobar compra = ENTRADA por línea + compensación (salida) si falla una línea; doble aprobar/rechazar aprobada → 409; aprobar venta = SALIDA por línea con reversión y 409 de stock; rechazo sin tocar inventario | ✅ |
| 18 | Compras/Ventas | API + integración | `tests/integration/orders.test.js` | CRUD proveedor/cliente (código mayúsculas, dup 409, guardas con documentos → 409, borrado sin historial → 200); 403 canónico `suppliers.create`/`purchases.create`/`purchases.approve`/`sales.orders.approve`; PO/SO con `total` del servidor e inyección `status` → 400; IDs ajenos → 404; compra aprueba ⇒ stock 5/2 y movimientos con `reference=PO-000001`; venta aprueba ⇒ stock A=1; venta sin stock ⇒ 409 y sigue `DRAFT`; rechazo `REJECTED`+motivo y aprobación posterior → 409; filtros `status`/`supplierId`/`search`; aislamiento total empresa B; auditoría con `resourceId` | APROBADO |
| 19 | Permisos/Compras-Ventas | Unitaria | `tests/unit/permissions.test.js` (extensión FASE 4) | grupos PURCHASES/SUPPLIERS/SALES/CUSTOMERS completos; aprueban sólo admin+gerente; compras crea pero no aprueba; ventas crea pero no aprueba; quién crea proveedores/clientes; gerente/finanzas/auditor/consulta sólo lectura de documentos | ✅ |
| 20 | Finanzas | Unitaria | `tests/unit/finance-validation.test.js` | cuentas (código/moneda estrictos, `balance` fuera de `CREATE_FIELDS`), ingresos/gastos `amount > 0` y schema estricto (sin `status/code/companyId` del cliente), anulación exige `reason` (`VOID_FIELDS`), presupuestos con año/mes acotados, `listQuery` con enums `POSTED/VOID`, reportes: `from > to` ⇒ inválido, query estricta, `budgets` exige `year` | ✅ |
| 21 | Finanzas | Unitaria | `tests/unit/finance-rules.test.js` | `applyMovement` optimista (3 reintentos ⇒ 409 de carrera), débito sin saldo ⇒ 409 con `available`, abono a cuenta negativa permitido, inactiva ⇒ 409, cuenta ajena ⇒ 404; creación de ingreso/gasto con código secuencial y **compensación** (borrado del documento) si el saldo falla; anulación condicional `POSTED→VOID` (doble ⇒ 409) con reversión del marcado si invertir el saldo falla; duplicados de cuenta/presupuesto ⇒ 409 canónico; guardas de borrado; IDs ajenos ⇒ 404 | ✅ |
| 22 | Finanzas | API + integración | `tests/integration/finance.test.js` | CRUD de cuentas (mayúsculas, dup 409, inyección `balance` → 400); 403 canónico `finance.accounts.create/update`, `finance.income.create/read`, `finance.budgets.create`; ingresos/gastos con códigos `INC/EXP` y saldo reflejado; gasto > saldo ⇒ 409 con `available` y **sin dejar documento** (compensación); hueco documentado del contador; cuenta ajena ⇒ 404; anulación invierte el saldo, doble anulación ⇒ 409, filtros `status`; append-only (PATCH/DELETE ⇒ 404); guardas de cuenta (409/200); presupuestos con clave única y aislamiento empresa B; auditoría `POST_FINANCE` con `resourceId` | APROBADO |
| 23 | Reportes | API + integración | `tests/integration/reports.test.js` | KPI (ventas/compras aprobadas, ingresos/gastos/neto, conteos, stock bajo); reportes por estado + serie mensual; inventario valorizado a costo; finanzas por mes/año/histórico; presupuesto vs ejecutado (mensual y anual, categorías sin presupuesto); validaciones 422 (`year` obligatorio, rango invertido, query estricta); CSV con BOM y códigos; 403 `reports.export`; empresa B en ceros; 401 | APROBADO |
| 24 | Permisos/Finanzas | Unitaria | `tests/unit/permissions.test.js` (extensión FASE 5) | grupos FINANCE/REPORTS completos; sólo admin+finanzas escriben dinero; gerente/auditor sólo leen (sin `.void` ni delete); presupuestos: gerente lee, finanzas administra, auditor/consulta no; `reports.read` amplio vs `reports.export` restringido | ✅ |
| 25 | CRM/RRHH | Unitaria | `tests/unit/crm-hr-validation.test.js` | lead: payload mínimo/normalización de email, enums `status/source`, `expectedAmount ≥ 0`, schema estricto (sin `companyId/createdBy`), PATCH parcial no vacío, listQuery con enums; empleado: `documentId ≥ 3`, apellidos obligatorios, `salary ≥ 0`, enum `status`, `hireDate` coercida, schema estricto, PATCH/listQuery | ✅ |
| 26 | CRM/RRHH | Unitaria | `tests/unit/crm-hr-rules.test.js` | lead: asignación a usuario ajeno ⇒ 404, defaults `NEW/other`, transición inválida ⇒ 409, transición válida ⇒ update, mismo estado = no-op, lead cerrado ⇒ 409; empleado: duplicado ⇒ 409 canónico con `details.fields` (create y update con exclusión del propio), lifecycle `status inactive` sin `deleteById`, IDs ajenos ⇒ 404; ningún service FASE 6 expone `remove` | ✅ |
| 27 | Producción | Unitaria | `tests/unit/production-validation.test.js` | BOM: componentes ≥ 1, quantity > 0, autoreferencia/repetidos ⇒ inválido, `code/companyId` fuera de `CREATE_FIELDS`, PATCH no vacío y cruce `productId↔components`; OT: `warehouseId` opcional, quantity > 0, inyección `status/code/lines`, `emptyBody` tolera body ausente pero rechaza campos, `cancelSchema` exige `reason` (`CANCEL_FIELDS`), listQuery con estados del flujo | ✅ |
| 28 | Producción | Unitaria | `tests/unit/production-rules.test.js` | BOM: numeración `BOM-000005`, 404/409/422 sin consumir contador, merge del patch en update; OT: almacén predeterminado, `MO-000001` en DRAFT, 404/409 de BOM/almacén sin numeración, edición sólo DRAFT; release: salidas escaladas + snapshot, redondeo a 4 dec., estados bloqueados ⇒ 409, fallo en la 2ª línea ⇒ devolución de la 1ª y sin cambio de estado, carrera `markReleased` ⇒ 409 con devolución total; done: entrada + carrera `markDone` con re-extracción; cancel: DRAFT sin inventario, RELEASED devuelve material, fallo/carrera ⇒ compensación; IDs ajenos ⇒ 404 | ✅ |
| 29 | CRM/RRHH | API + integración | `tests/integration/crm-hr.test.js` | lead 201 `NEW`, inyección `companyId` → 400, 403 canónicos `crm.read/create` (consulta/gerente/rrhh), ciclo completo `NEW→…→WON`, transición inválida ⇒ 409, lead cerrado ⇒ 409, DELETE ⇒ 404, asignación usuario ajeno ⇒ 404, aislamiento empresa B; empleado 201, duplicado ⇒ 409 con `details.fields`, inyección → 400, 403 canónicos `hr.read/create`, baja `inactive` + filtros, DELETE ⇒ 404, aislamiento (mismo documento válido en B); auditoría `POST_CRM`/`POST_HR` con `resourceId` | APROBADO |
| 30 | Producción | API + integración | `tests/integration/production.test.js` | BOM `BOM-000001`, inyección `code` → 400, autoreferencia/vacío ⇒ 422 canónico, producto ajeno ⇒ 404, 403 canónicos `production.read/create`, DELETE ⇒ 404; OT `MO-000001` con almacén por defecto, BOM ajeno ⇒ 404, edición DRAFT (6→4), release con stock C1=92/C2=88 y `lines` snapshot, release repetido/PATCH tras release ⇒ 409, release sin stock ⇒ 409 con `available` + compensación total (stock intacto, OT sigue `DRAFT`), done ⇒ FIN=4 y doble done ⇒ 409, cancel desde RELEASED devuelve material con motivo (422 sin reason) y doble cancel ⇒ 409, done en DRAFT ⇒ 409, DELETE ⇒ 404, RBAC/aislamiento, auditoría `POST_PRODUCTION` con `resourceId` | APROBADO |
| 31 | Permisos/FASE 6 | Unitaria | `tests/unit/permissions.test.js` (extensión FASE 6) | grupos CRM/HR/PRODUCTION completos y **sin `.delete`**; CRM: escribe ventas (y admin) y lee gerente; HR: escribe rrhh (y admin) y lee gerente; producción: escribe produccion (y admin) y gerente/auditor NO leen; roles FASE 6 sin escalada (produccion con inventario pero sin users/roles, rrhh sin dinero) | ✅ |

## Cobertura por tipo de QA exigido

| Tipo exigido | Dónde queda cubierto |
|---|---|
| Unitarias | #1–#8, #12, #13, #15–#17, #19–#21, #24–#28, #31 — ✅ todas ejecutadas |
| API | #9-#11, #14, #18, #22, #23, #29, #30 | APROBADO (ejecutadas) |
| Integracion | #9-#11, #14, #18, #22, #23, #29, #30 | APROBADO: 181/181 (MongoDB efimero) |
| Permisos | #1 (catálogo), #10 (403 con mensaje, anti-escalada, catálogo), #14, #15, #18, #19, #24, #31 |
| Multiempresa | #3, #4, #10, #11, #13, #14, #17, #18, #21, #22, #23, #26, #28, #29, #30 |
| Errores | #5 + validaciones 422/404/409/401 dispersas en #9–#11, #12–#14, #16–#18, #20–#23, #25–#30 |
| Regresión | `npm test` completo antes de cada fase; añadir aquí todo bug corregido con su test |

## Regla de TERMINADO

1. Todas las suites en ✅ sin `--runInBand` omitido ni skips ocultos.
2. Cobertura de líneas de `src/` ≥ 80% (revisar `npx jest --coverage`).
3. Cada bug corregido ⇒ test nuevo en esta matriz.
4. Actualizar `docs/CHANGELOG.md`.
