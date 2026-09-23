# ERP Multiempresa

ERP modular multiempresa: **React Native + React Native Web** (Expo) · **Node.js + Express** · **MongoDB Atlas** · roles nativos Android (Kotlin) sólo para funciones puntuales.

> Estado actual: **FASE 0–7 completadas en código** (diagnóstico, backend base, core, inventario, compras/ventas, finanzas/reportes, CRM/RRHH/producción y **frontend de módulos**). **QA**: Node.js v24.19.0 instalado; unitarias ✅ **18/18 suites · 264/264 pruebas** (5 defectos detectados y corregidos); **export web ✅ 243 módulos** (2 defectos de frontend detectados y corregidos); API/integración ⬜ pendientes de `MONGO_URI_TEST`. Ver `docs/qa/matriz-pruebas.md`. Fases siguientes: **8 IA · 9 Integraciones**.

## Estructura

```
diplo/
├── .env.example          # plantilla de variables (NUNCA subir .env real)
├── package.json          # scripts orquestadores (raíz)
├── backend/              # API Express (/api/v1)
│   ├── jest.config.js
│   ├── src/
│   │   ├── app.js        # composición (sin listen) ← la importan los tests
│   │   ├── server.js     # arranque + graceful shutdown
│   │   ├── config/       # env, database, logger, permissions (catálogo RBAC)
│   │   ├── common/       # BaseRepository, errorTranslator, privilege, sequence (contador)
│   │   ├── middlewares/  # authenticate, authorize, validate, tenant, audit...
│   │   ├── utils/        # ApiError, tokens, password, pagination, response...
│   │   ├── modules/      # auth, companies, branches, roles, users, audit, products, warehouses, inventory, suppliers, customers, purchase-orders, sales-orders, accounts, incomes, expenses, budgets, reports, crm, hr, production
│   │   │   └── <mod>/    # model · repository · service · controller · validation · routes
│   │   └── scripts/seed.js
│   └── tests/            # unit/ · integration/ · helpers/
├── database/indexes/     # apply-indexes.js (sync de índices)
├── docs/
│   ├── architecture/decisions.md   # ADR-001..013
│   ├── api/core.md                 # endpoints FASE 2 + 3 + 4 + 5 + 6
│   ├── database/README.md          # colecciones e índices
│   └── qa/matriz-pruebas.md        # matriz QA + cómo ejecutar
└── frontend/             # Expo (RN + RN Web) — FASE 7: 22 pantallas + shell
    ├── App.js            # RouterProvider + Layout + SCREENS
    └── src/
        ├── api/          # client.js (con token, refresh y CSV)
        ├── auth/         # AuthContext (sesión + can())
        ├── components/   # Layout, DataTable, FormModal, Dropdown, Confirm, DetailModal...
        ├── hooks/        # useList / usePicklist
        ├── nav/          # RouterContext (router propio por estado)
        └── screens/      # inventory/ purchases/ sales/ finance/ crm/ hr/ production/ config/
```

## Requisitos

- Node.js ≥ 18 y npm
- Una base MongoDB (Atlas) de desarrollo; opcional: BD de test para pruebas de integración
- Sin Node instalado: instalar desde https://nodejs.org (LTS) y reiniciar la terminal

## Puesta en marcha

```powershell
# 1) Variables de entorno (en la RAÍZ del proyecto)
copy .env.example .env
#    → completar MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (>=32 chars)

# 2) Dependencias
npm --prefix backend install
npm --prefix frontend install

# 3) Índices y semilla
npm run indexes
npm run seed              # Super Admin (SEED_ADMIN_EMAIL)
npm run seed -- --demo    # + Empresa Demo: 10 roles, almacén MAIN, catálogos demo (incl. BOM/empleado/lead FASE 6) y admin (admin@demo.example.com)

# 4) Correr
npm run dev:backend       # API en http://localhost:4000/api/v1  (health: /health)
npm run dev:frontend      # Expo (web: npm run web:frontend → http://localhost:19006)
```

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev:backend` | API con recarga (nodemon) |
| `npm run dev:frontend` | Expo dev server |
| `npm run seed [-- --demo]` | Semilla idempotente (no cambia contraseñas existentes) |
| `npm run indexes` | `syncIndexes()` de todos los modelos |
| `npm run test:unit` | Unitarias (sin BD) |
| `npm run test:integration` | API/integración — requiere `MONGO_URI_TEST` |
| `npm test` | Todo en serie (`--runInBand`) |

```powershell
# Pruebas de integración (PowerShell) — BD DESCARTABLE, nunca producción:
$env:MONGO_URI_TEST="mongodb+srv://.../erp_test?retryWrites=true&w=majority"
npm run test:integration
```

## Seguridad implementada (FASE 2)

- **Multiempresa**: `companyId` siempre sale del token; `BaseRepository` lanza si falta en cualquier query de negocio (ADR-004); rutas `:id` con `assertOwnership` → 404 entre tenants.
- RBAC granular `products.*`, `warehouses.*`, `inventory.*` (FASE 3), `suppliers.*`, `customers.*`, `purchases.*`, `sales.orders.*` (FASE 4) y `finance.*` (dinero append-only con `.void`, cuentas y presupuestos) + `reports.read/export` (FASE 5) y `crm.*`, `hr.*`, `production.*` (FASE 6: grupos **sin `.delete`** — la baja es por estado, ADR-012); catálogo en código (ADR-002); anti-escalada: nadie otorga permisos que no posee.
- **Auth**: JWT access 15m + refresh 7d; 5 intentos → bloqueo; mensaje único de login (anti-enumeración); logout global por `tokenVersion` (ADR-003).
- **Errores**: siempre `{ success:false, error:{ code, message } }` con mensajes amigables; jamás stack traces, tokens ni contraseñas.
- **Auditoría** inmutable de mutaciones con `before/after` redactado (ADR-005); sólo lectura vía API.
- **Secretos** sólo en `.env` (fuera de git); logger con redacción de cabeceras/credenciales.
- Rate limit global + estricto en login; helmet; CORS por orígenes.

## Fases

| Fase | Estado |
|---|---|
| 0 Diagnóstico | ✅ |
| 1 Backend base | ✅ código |
| 2 Core (auth/usuarios/empresas/sucursales/roles/permisos/auditoría) | ✅ código + unitarias ✅, ⏳ integración |
| 3 Inventario (productos/almacenes/stock/movimientos) | ✅ código + unitarias ✅, ⏳ integración |
| 4 Compras/Ventas (proveedores/clientes/órdenes) | ✅ código + unitarias ✅, ⏳ integración |
| 5 Finanzas/Reportes | ✅ código + unitarias ✅, ⏳ integración |
| 6 CRM/RRHH/Producción | ✅ código + unitarias ✅, ⏳ integración |
| 7 Frontend de módulos (22 pantallas RN/RN Web) | ✅ código + unitarias ✅ + **export web ✅** (243 módulos), ⏳ prueba visual manual |
| 8 IA | ⬜ |
| 9 Integraciones | ⬜ |
#Diplomado
