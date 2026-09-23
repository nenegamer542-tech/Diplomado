# Estado actual de la arquitectura

Fecha de revision: 2026-09-23
Repositorio: nenegamer542-tech/Diplomado
Rama local: `main`, HEAD `3bff87a` (`terminotrasero`), inicialmente alineada con `origin/main` y limpia.
Alcance: inspeccion estatica de backend, frontend, configuracion y documentacion; pruebas unitarias e integracion ejecutadas. No se ejecutaron pruebas visuales ni E2E frontend.

## Resumen

El proyecto existente es una aplicacion ERP modular con API REST Node.js/Express y MongoDB en `backend/`, cliente Expo React Native/React Native Web en `frontend/`, scripts de indices en `database/` y documentacion en `docs/`. El arbol de `main` contiene 305 rutas. La estructura es coherente con el objetivo modular y no requiere reconstruccion.

Hay modulos de core, inventario, compras/ventas, finanzas/reportes, CRM, RRHH y produccion. El README informa que las fases 0-7 estan en codigo. Pruebas unitarias, integracion y cobertura de lineas pasan; faltan la prueba visual y E2E frontend.

## Matriz de estado

| Area | Estado actual | Objetivo | Faltante | Riesgo | Prioridad |
|---|---|---|---|---|---|
| Arquitectura | Backend por capas y modulos; Expo/RN Web; 305 rutas remotas | Evolucionar el repo existente | Ampliar solo segun procesos priorizados | Fases de codigo pueden confundirse con fases aprobadas | Alta |
| Core y seguridad | Auth, usuarios, empresas, sucursales, roles, permisos, auditoria y guards tenant presentes; integracion cubre login, RBAC e IDOR | Aislamiento y permisos verificados en cada endpoint | Auditoria especializada y pruebas adicionales de concurrencia | Ruta sin guard podria permitir acceso indebido | Critica |
| Master data | Productos, clientes, proveedores y almacenes | Maestros compartidos y reutilizables | No hay modulos dedicados para categorias, marcas, unidades, impuestos, monedas ni centros de costo/periodos fiscales | Campos libres pueden divergir entre modulos | Alta |
| Inventario | Stock, movimientos, ajustes, transferencias; conectado a aprobacion de ordenes y produccion | Kardex y procesos completos | No aparecen lotes, series ni inventario fisico; validar alertas/minimos/maximos | Trazabilidad parcial | Alta |
| Compras/ventas | Proveedores, clientes y ordenes; aprobacion genera movimientos con compensacion | Procure-to-pay y order-to-cash completos | No se observan cotizaciones, recepciones parciales, facturas, pagos, devoluciones ni CxP/CxC automaticas | Proceso comercial y financiero incompleto | Alta |
| Finanzas/BI | Cuentas, ingresos, gastos, presupuestos y reportes | Integracion financiera desde compras/ventas | Integracion automatica con ordenes no observada; cobertura no medida | Reportes pueden estar desconectados de compras/ventas | Alta |
| CRM/RRHH/produccion | Leads, empleados, BOM y ordenes conectadas a inventario | Flujos completos con maestros compartidos | No aparecen asistencia/vacaciones, proyectos, activos ni POS; departamentos/puestos no son entidades | Alcance parcial frente al objetivo | Alta |
| Frontend | Pantallas de core, inventario, compras, ventas, finanzas, CRM, RRHH y produccion | UX web/movil alineada con permisos | Validacion visual manual pendiente; faltan pantallas para modulos ausentes | UX real no acreditada | Media |
| QA | 18 suites unitarias y 9 de integracion ejecutadas; todas pasan | Unit, API, integracion, E2E y seguridad con umbrales | E2E y prueba visual pendientes | Aprobacion funcional parcial | Alta |
| Configuracion | `.env.example` usa `MONGO_URI`; no hay `.env` local | Secretos fuera del codigo y configuracion reproducible | Rotar credencial expuesta historicamente y decidir saneamiento del historial | Credencial antigua sigue en commits publicos previos | Critica |
| Git/documentacion | Rama local parte de `3bff87a`; diff de auditoria sin commit | Trazabilidad por fase | Revisar diff antes de commit; documentar rotacion | Cambio local no revoca secreto | Alta |

## Modulos y capas presentes

- Backend Express: routes, controllers, services, repositories, models y validaciones Zod.
- Middleware: authenticate, authorize, tenant, validate, rate limit, audit y errores.
- Modulos: empresas, sucursales, usuarios, roles, auditoria, productos, almacenes, stock/movimientos, proveedores/clientes, ordenes, cuentas/ingresos/gastos/presupuestos/reportes, leads, empleados, BOM y produccion.
- Frontend Expo: API client, AuthContext, componentes y pantallas para modulos existentes.
- Jest/Supertest con fixtures multiempresa y MongoDB efimero.
- ADR, documentos API/DB/QA, README y CHANGELOG.

## Seguridad y configuracion

La revision estatica confirmo guards `authenticate` y `authorize` en las rutas inspeccionadas. `BaseRepository` exige `companyId` en repositorios tenant y el middleware tenant evita que filtros del cliente suplanten el tenant del token. Las pruebas de integracion cubren inyeccion de `companyId`, acceso cross-tenant y RBAC en los flujos probados.

`.env.example` estaba versionado y contenia una URI MongoDB con credenciales aparentes en el commit publico `3bff87a`. Ademas, usaba `MONGODB_URI`, mientras backend requiere `MONGO_URI`. Se retiraron esas asignaciones de la plantilla y se agrego una URI de ejemplo sin credenciales con el nombre correcto. No existe `.env` local. Este cambio no revoca la credencial ni borra sus valores de commits anteriores.

Accion externa prioritaria: rotar/revocar el usuario o clave desde Atlas y revisar acceso/logs. Limpiar historial publico reescribe commits y requiere decision coordinada; no reemplaza la rotacion.

## Integracion observada y faltante

Ordenes de compra/venta aprobadas actualizan inventario mediante el servicio compartido; produccion libera/termina ordenes con movimientos y compensacion. Finanzas maneja ingresos/gastos append-only y saldos. No se encontro generacion automatica de factura, pago ni CxP/CxC desde ordenes. CRM comparte el concepto de cliente existente, pero no hay flujo completo lead > cliente > cotizacion > venta.

No se confirmo duplicacion de colecciones de clientes/proveedores. Compras, ventas y produccion invocan el servicio compartido de inventario.

## QA ejecutado

- Unitarias: `npm.cmd --prefix backend run test:unit` - 18/18 suites, 264/264 pruebas aprobadas.
- API/integracion: `npm.cmd --prefix backend run test:integration` - 9/9 suites, 181/181 pruebas aprobadas con MongoDB efimero.
- El primer recorrido encontro el KPI sales con un campo extra y fixtures/expectativas defectuosas. Se normalizo el KPI a `{count,total}` y se corrigieron las pruebas. El segundo recorrido paso completo.
- Reporte anual: el filtro por year incluye todo el calendario; se corrigio la expectativa que excluia julio sin pedir rango parcial.
- `git diff --check`: limpio.
- Cobertura de lineas: 87.97% (2902/3299), supera el objetivo >=80%. Cobertura de ramas: 40.37% (631/1563).
- No se ejecuto export web en esta auditoria. La matriz documenta export previo exitoso; prueba visual pendiente.

## Dependencias observadas

Node.js v24.19.0, npm 11.7.0, Express 4, Mongoose 8, Jest 29, Supertest 7, Expo 51, React 18, React Native 0.74 y React Native Web 0.19 (segun manifests). Las pruebas de integracion corrieron con `mongodb-memory-server`, sin Atlas.

## Estado de Fase 0

Diagnostico y matriz creados; KPI corregido; 27/27 suites y 445/445 pruebas aprobadas; cobertura de lineas 87.97%. **FASE 0: NO APROBADA** hasta rotar externamente la credencial expuesta y decidir saneamiento del historial. La validacion visual de Fase 7 sigue pendiente.