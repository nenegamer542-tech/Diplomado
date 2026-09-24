# Estado actual de la arquitectura

## Seguimiento de inventario (2026-09-24)

Se implementó trazabilidad por lote y serie dentro de inventario, propagada a los flujos existentes de compra, venta y producción. Se agregó el proceso de conteo físico con estados persistidos, aplicación idempotente por línea, reanudación de publicación parcial y validación optimista contra cambios de stock. La publicación de conteos sólo admite actualmente productos `trackingMode=none`; la conciliación de existencias por lote/serie sigue pendiente. Por ello, Fase 3 continúa NO APROBADA.

Fecha de revision: 2026-09-24
Repositorio: nenegamer542-tech/Diplomado
Rama local y remota: `main`, HEAD `942bea9` (`audit: document ERP state and validate QA`); la historia publicada se reescribio para retirar las credenciales del commit anterior.
Alcance: inspeccion estatica de backend, frontend, configuracion y documentacion; pruebas unitarias e integracion ejecutadas y exportacion web completada. La inspeccion visual y E2E frontend no se pudieron ejecutar porque no hay navegador automatizable instalado.

## Resumen

El proyecto existente es una aplicacion ERP modular con API REST Node.js/Express y MongoDB en `backend/`, cliente Expo React Native/React Native Web en `frontend/`, scripts de indices en `database/` y documentacion en `docs/`. El arbol de `main` contiene 305 rutas. La estructura es coherente con el objetivo modular y no requiere reconstruccion.

Hay modulos de core, inventario, compras/ventas, finanzas/reportes, CRM, RRHH y produccion. El README informa que las fases 0-7 estan en codigo. Pruebas unitarias, integracion y cobertura de lineas pasan; faltan la prueba visual y E2E frontend.

## Matriz de estado

| Area | Estado actual | Objetivo | Faltante | Riesgo | Prioridad |
|---|---|---|---|---|---|
| Arquitectura | Backend por capas y modulos; Expo/RN Web; 305 rutas remotas | Evolucionar el repo existente | Ampliar solo segun procesos priorizados | Fases de codigo pueden confundirse con fases aprobadas | Alta |
| Core y seguridad | Auth, usuarios, empresas, sucursales, roles, permisos, auditoria y guards tenant presentes; integracion cubre login, RBAC e IDOR | Aislamiento y permisos verificados en cada endpoint | Auditoria especializada y pruebas adicionales de concurrencia | Ruta sin guard podria permitir acceso indebido | Critica |
| Master data | Productos, clientes, proveedores y almacenes; catálogos tenant-scoped para categorías, marcas, unidades, monedas e impuestos implementados en Fase 2 | Maestros compartidos y reutilizables | Centros de costo/periodos fiscales pendientes; migración de catálogos históricos debe ejecutarse por entorno | Datos legados siguen como snapshots hasta correr backfill | Alta |
| Inventario | Stock, movimientos, umbrales/alertas; lotes/series conectados a compra, venta y producción; conteo idempotente para productos sin trazabilidad | Kardex y procesos completos | Conteo de artículos por lote/serie; QA completo del nuevo alcance | Descuadre entre saldo agregado y detalle trazable si se fuerza ajuste fuera del conteo actual | Alta |
| Compras/ventas | Proveedores, clientes y ordenes; aprobacion genera movimientos con compensacion | Procure-to-pay y order-to-cash completos | No se observan cotizaciones, recepciones parciales, facturas, pagos, devoluciones ni CxP/CxC automaticas | Proceso comercial y financiero incompleto | Alta |
| Finanzas/BI | Cuentas, ingresos, gastos, presupuestos y reportes | Integracion financiera desde compras/ventas | Integracion automatica con ordenes no observada; cobertura no medida | Reportes pueden estar desconectados de compras/ventas | Alta |
| CRM/RRHH/produccion | Leads, empleados, BOM y ordenes conectadas a inventario | Flujos completos con maestros compartidos | No aparecen asistencia/vacaciones, proyectos, activos ni POS; departamentos/puestos no son entidades | Alcance parcial frente al objetivo | Alta |
| Frontend | Pantallas de core, inventario, compras, ventas, finanzas, CRM, RRHH y produccion | UX web/movil alineada con permisos | Exportacion web aprobada (240 modulos, bundle 496 kB); validacion visual manual pendiente por falta de navegador | UX real no acreditada | Media |
| QA | 19 suites unitarias y 9 de integracion ejecutadas; 449/449 pruebas pasan | Unit, API, integracion, E2E y seguridad con umbrales | E2E y prueba visual pendientes | Aprobacion funcional parcial | Alta |
| Configuracion | `.env.example` usa `MONGO_URI`; no hay `.env` local | Secretos fuera del codigo y configuracion reproducible | Revocar la credencial en Atlas; la rama publica `main` ya fue reescrita | La revocacion y la limpieza de copias/caches externos no se verifican desde este entorno | Critica |
| Git/documentacion | Rama `main` local/remota parte de `942bea9`; cambios actuales solo de documentacion | Trazabilidad por fase | Rotar credencial; validar UI manualmente; tratar respaldo local antiguo | La historia previa sigue en refs/objetos locales de recuperacion | Alta |

## Modulos y capas presentes

- Backend Express: routes, controllers, services, repositories, models y validaciones Zod.
- Middleware: authenticate, authorize, tenant, validate, rate limit, audit y errores.
- Modulos: empresas, sucursales, usuarios, roles, auditoria, productos, almacenes, stock/movimientos, proveedores/clientes, ordenes, cuentas/ingresos/gastos/presupuestos/reportes, leads, empleados, BOM y produccion.
- Frontend Expo: API client, AuthContext, componentes y pantallas para modulos existentes.
- Jest/Supertest con fixtures multiempresa y MongoDB efimero.
- ADR, documentos API/DB/QA, README y CHANGELOG.

## Seguridad y configuracion

La revision estatica confirmo guards `authenticate` y `authorize` en las rutas inspeccionadas. `BaseRepository` exige `companyId` en repositorios tenant y el middleware tenant evita que filtros del cliente suplanten el tenant del token. Las pruebas de integracion cubren inyeccion de `companyId`, acceso cross-tenant y RBAC en los flujos probados.

`.env.example` estaba versionado y contenia una URI MongoDB con credenciales aparentes en el commit publico `3bff87a`. Ademas, usaba `MONGODB_URI`, mientras backend requiere `MONGO_URI`. Se retiraron esas asignaciones de la plantilla y se agrego una URI de ejemplo sin credenciales con el nombre correcto. No existe `.env` local. La rama publica `main` se reescribio el 2026-09-23 y su historial actual ya no contiene las asignaciones antiguas. La clave debe revocarse de todos modos: cambiar Git no invalida la credencial ni elimina clones, caches o copias previas. Un respaldo local temporal aun conserva el historial anterior; su eliminacion/purga fue bloqueada por la revision automatica por ser irreversible.

Accion externa prioritaria: rotar/revocar el usuario o clave desde Atlas y revisar acceso/logs. La reescritura de `main` ya se realizo y GitHub reporta unicamente esa rama en el repositorio. Esto no reemplaza la rotacion.

## Integracion observada y faltante

Ordenes de compra/venta aprobadas actualizan inventario mediante el servicio compartido; produccion libera/termina ordenes con movimientos y compensacion. Finanzas maneja ingresos/gastos append-only y saldos. No se encontro generacion automatica de factura, pago ni CxP/CxC desde ordenes. CRM comparte el concepto de cliente existente, pero no hay flujo completo lead > cliente > cotizacion > venta.

No se confirmo duplicacion de colecciones de clientes/proveedores. Compras, ventas y produccion invocan el servicio compartido de inventario.

## QA ejecutado

- Unitarias: `npm.cmd --prefix backend run test:unit` - 19/19 suites, 267/267 pruebas aprobadas.
- API/integracion: `npm.cmd --prefix backend run test:integration` - 9/9 suites, 182/182 pruebas aprobadas con MongoDB efimero.
- El primer recorrido encontro el KPI sales con un campo extra y fixtures/expectativas defectuosas. Se normalizo el KPI a `{count,total}` y se corrigieron las pruebas. El segundo recorrido paso completo.
- Reporte anual: el filtro por year incluye todo el calendario; se corrigio la expectativa que excluia julio sin pedir rango parcial.
- `git diff --check`: limpio.
- Cobertura de lineas: 88.09% (2945/3343), supera el objetivo >=80%. Cobertura de ramas: 62.27% (992/1593).
- `npm.cmd run export:web` en `frontend/`: exportacion exitosa, 240 modulos, bundle 496 kB. No fue posible abrir Firefox (Windows no permite ejecutar el alias disponible); no hay Playwright/Puppeteer instalado. Validacion visual y E2E quedan pendientes.

## Dependencias observadas

Node.js v24.19.0, npm 11.7.0, Express 4, Mongoose 8, Jest 29, Supertest 7, Expo 51, React 18, React Native 0.74 y React Native Web 0.19 (segun manifests). Las pruebas de integracion corrieron con `mongodb-memory-server`, sin Atlas.

## Seguimiento del core — 2026-09-24

Se incorporó persistencia de sesiones de refresh: cada token lleva un `jti` aleatorio, la colección `sessions` conserva sólo su hash, y el refresh se consume con una actualización atómica para impedir replay. Se agregó `/companies/me/settings` con RBAC, validación estricta y tenant derivado del token. La suite completa pasó: 19 suites unitarias/267 pruebas, 9 suites de integración/182 pruebas, 449 pruebas en total; cobertura de líneas 88.09% (2945/3343) y ramas 62.27% (992/1593). No se usó Atlas como base de pruebas.

## Estado de Fase 0

Diagnostico y matriz creados; KPI corregido; 27/27 suites y 445/445 pruebas aprobadas; cobertura de lineas 87.97%. **FASE 0: NO APROBADA** hasta revocar externamente la credencial expuesta. La rama publica ya esta saneada; queda una copia local recuperable y la purga fue bloqueada por auto-review. La validacion visual de Fase 7 sigue pendiente por falta de navegador.

## Seguimiento de Fase 2 — 2026-09-24

La implementación agrega `/master-data` con catálogos tipados y aislamiento por `companyId` del token. Productos validan referencias de categoría, marca, unidad e impuesto; empresas y cuentas enlazan moneda. Las empresas existentes requieren ejecutar `npm run migrate:master-data` desde `backend/`; el script es idempotente, no borra snapshots y actualiza permisos de roles de sistema existentes. En QA dirigido pasaron 3 suites/42 pruebas y en la regresión completa 29 suites/454 pruebas. Fase 2 aprobada en código y QA; la ejecución de la migración en cada entorno sigue pendiente.

## Seguimiento de Fase 3 — 2026-09-24

Inventario ya tenia entradas, salidas, ajustes, transferencias, Kardex inmutable y consumo desde compras/produccion. Este incremento agrega stock maximo, validacion `maxStock >= minStock`, y `GET /api/v1/inventory/alerts`, agregado por producto entre almacenes y con tenant del token. La integracion dirigida del modulo paso. La Fase 3 permanece NO APROBADA: faltan lotes, series e inventario fisico formal; no se inicia Fase 4.
