'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { randomUUID } = require('crypto');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./config/logger');
const { apiLimiter } = require('./middlewares/rateLimit');
const auditMiddleware = require('./middlewares/audit.middleware');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const authRoutes = require('./modules/auth/auth.routes');
const companyRoutes = require('./modules/companies/company.routes');
const branchRoutes = require('./modules/branches/branch.routes');
const roleRoutes = require('./modules/roles/role.routes');
const userRoutes = require('./modules/users/user.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const masterDataRoutes = require('./modules/master-data/master_data.routes');
const productRoutes = require('./modules/products/product.routes');
const warehouseRoutes = require('./modules/warehouses/warehouse.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');

// 5) Módulos FASE 4 (compras/ventas).
const supplierRoutes = require('./modules/suppliers/supplier.routes');
const customerRoutes = require('./modules/customers/customer.routes');
const purchaseOrderRoutes = require('./modules/purchase-orders/purchase_order.routes');
const salesOrderRoutes = require('./modules/sales-orders/sales_order.routes');

// 6) Módulos FASE 5 (finanzas/reportes).
const accountRoutes = require('./modules/accounts/account.routes');
const incomeRoutes = require('./modules/incomes/income.routes');
const expenseRoutes = require('./modules/expenses/expense.routes');
const budgetRoutes = require('./modules/budgets/budget.routes');
const reportRoutes = require('./modules/reports/report.routes');

// 7) Módulos FASE 6 (CRM/RRHH/producción).
const leadRoutes = require('./modules/crm/lead.routes');
const employeeRoutes = require('./modules/hr/employee.routes');
const bomRoutes = require('./modules/production/bom.routes');
const productionOrderRoutes = require('./modules/production/production_order.routes');

/**
 * Aplicación Express (sin listen — el arranque vive en server.js;
 * los tests importan este módulo con supertest).
 *
 * Cadena: helmet → CORS → body JSON → logging → rate limit →
 * rutas /api/v1 (auth montada ANTES que el audit global; las mutaciones
 * de /auth se auditan en su service para capturar intentos fallidos).
 */
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // IP real detrás de proxy (rate limit + auditoría)

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Sin Origin (apps móviles/cURL) se permite: la seguridad está en el token.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false); // sin cabeceras CORS => el navegador bloquea
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.use(
  pinoHttp({
    logger,
    autoLogging: !env.isTest,
    genReqId: () => randomUUID(),
  })
);

/** Health check público para monitoreo/load balancer. */
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

const router = express.Router();

// 1) Autenticación ANTES del audit global (su service audita a mano).
router.use('/auth', authRoutes);

// 2) Auditoría de mutaciones: envuelve res.json y lee req.user ya resuelto
//    por authenticate dentro de cada ruta (ver ADR-005).
router.use(auditMiddleware);

// 3) Módulos FASE 2 (core).
router.use('/companies', companyRoutes);
router.use('/branches', branchRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/audit', auditRoutes);
router.use('/master-data', masterDataRoutes);

// 4) Módulos FASE 3 (inventario).
router.use('/products', productRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/inventory', inventoryRoutes);

// 5) Módulos FASE 4 (compras/ventas).
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/sales-orders', salesOrderRoutes);

// 6) Módulos FASE 5 (finanzas/reportes).
router.use('/finance/accounts', accountRoutes);
router.use('/finance/incomes', incomeRoutes);
router.use('/finance/expenses', expenseRoutes);
router.use('/finance/budgets', budgetRoutes);
router.use('/reports', reportRoutes);

// 7) Módulos FASE 6 (CRM/RRHH/producción).
router.use('/crm/leads', leadRoutes);
router.use('/hr/employees', employeeRoutes);
router.use('/production/boms', bomRoutes);
router.use('/production/orders', productionOrderRoutes);

app.use(env.apiPrefix, apiLimiter, router);

// 4) 404 y manejador global de errores (siempre al final).
app.use(notFound);
app.use(errorHandler);

module.exports = app;
