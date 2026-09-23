'use strict';

/**
 * Catálogo central de permisos (RBAC).
 *
 * Decisión de arquitectura: el catálogo vive en CÓDIGO, no en una colección
 * de MongoDB. Ventajas: versionado con git, imposible corromperlo desde la
 * UI, revisable en PR. Los roles (en BD) guardan códigos de este catálogo.
 * Ver docs/architecture/decisions.md (ADR-002).
 *
 * Formato: <modulo>.<recurso>.<accion>
 */

const PERMISSIONS = {
  // --- Core ---
  COMPANIES: [
    'companies.read',
    'companies.create',
    'companies.update',
    'companies.delete',
  ],
  BRANCHES: ['branches.read', 'branches.create', 'branches.update', 'branches.delete'],
  USERS: ['users.read', 'users.create', 'users.update', 'users.delete'],
  ROLES: ['roles.read', 'roles.create', 'roles.update', 'roles.delete'],
  SETTINGS: ['settings.read', 'settings.update'],
  NOTIFICATIONS: ['notifications.read', 'notifications.update'],
  AUDIT: ['audit.read'],

  // --- Inventario (FASE 3) ---
  PRODUCTS: ['products.read', 'products.create', 'products.update', 'products.delete'],
  WAREHOUSES: ['warehouses.read', 'warehouses.create', 'warehouses.update', 'warehouses.delete'],
  INVENTORY: [
    'inventory.read',
    'inventory.movements.create',
    'inventory.transfers.create',
    'inventory.adjustments.create',
  ],

  // --- Compras (FASE 4) ---
  PURCHASES: ['purchases.read', 'purchases.create', 'purchases.update', 'purchases.approve'],
  SUPPLIERS: ['suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete'],

  // --- Ventas (FASE 4) ---
  SALES: ['sales.orders.read', 'sales.orders.create', 'sales.orders.update', 'sales.orders.approve'],
  CUSTOMERS: ['customers.read', 'customers.create', 'customers.update', 'customers.delete'],

  // --- Finanzas (FASE 5) ---
  // Ingresos/gastos son APPEND-ONLY: se crean, se leen y se ANULAN (void),
  // nunca se editan ni se borran (ADR-011).
  FINANCE: [
    'finance.income.read',
    'finance.income.create',
    'finance.income.void',
    'finance.expenses.read',
    'finance.expenses.create',
    'finance.expenses.void',
    'finance.accounts.read',
    'finance.accounts.create',
    'finance.accounts.update',
    'finance.accounts.delete',
    'finance.budgets.read',
    'finance.budgets.create',
    'finance.budgets.update',
    'finance.budgets.delete',
  ],

  // --- Reportes (FASE 5) ---
  REPORTS: ['reports.read', 'reports.export'],

  // --- CRM / RRHH / Producción (FASE 6) ---
  CRM: ['crm.read', 'crm.create', 'crm.update'],
  HR: ['hr.read', 'hr.create', 'hr.update'],
  PRODUCTION: ['production.read', 'production.create', 'production.update'],
};

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS).flat());

/** Permisos de plataforma válidos para Super Admin (fuera de tenant). */
const PLATFORM_PERMISSIONS = Object.freeze([
  'companies.read',
  'companies.create',
  'companies.update',
  'companies.delete',
]);

/** Roles iniciales y sus permisos. Semilla por empresa. */
const DEFAULT_ROLES = {
  administrador: {
    label: 'Administrador',
    description: 'Administra la empresa: usuarios, roles y configuración.',
    // Todo excepto crear/borrar empresas (gestión de plataforma).
    // Sí lee/actualiza SU empresa: la ruta acota el alcance al tenant del usuario.
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'companies.create' && p !== 'companies.delete'),
  },
  gerente: {
    label: 'Gerente',
    description: 'Visión global: ventas, compras, inventario, finanzas y KPI.',
    permissions: [
      'users.read', 'branches.read',
      'products.read', 'inventory.read', 'warehouses.read',
      'suppliers.read', 'purchases.read', 'purchases.approve',
      'customers.read', 'sales.orders.read', 'sales.orders.approve',
      'finance.income.read', 'finance.expenses.read', 'finance.accounts.read', 'finance.budgets.read',
      'reports.read', 'reports.export',
      'crm.read', 'hr.read',
      'notifications.read', 'notifications.update', 'audit.read',
    ],
  },
  ventas: {
    label: 'Ventas',
    description: 'Clientes, cotizaciones, pedidos y ventas.',
    permissions: [
      'customers.read', 'customers.create', 'customers.update',
      'sales.orders.read', 'sales.orders.create', 'sales.orders.update',
      'products.read', 'inventory.read',
      'crm.read', 'crm.create', 'crm.update',
      'reports.read',
      'notifications.read', 'notifications.update',
    ],
  },
  compras: {
    label: 'Compras',
    description: 'Proveedores, cotizaciones y órdenes de compra.',
    permissions: [
      'suppliers.read', 'suppliers.create', 'suppliers.update',
      'purchases.read', 'purchases.create', 'purchases.update',
      'products.read', 'inventory.read',
      'reports.read',
      'notifications.read', 'notifications.update',
    ],
  },
  almacen: {
    label: 'Almacén',
    description: 'Existencias, entradas, salidas, transferencias y stock bajo.',
    permissions: [
      'products.read', 'inventory.read', 'inventory.movements.create',
      'inventory.transfers.create', 'inventory.adjustments.create',
      'warehouses.read',
      'suppliers.read', 'customers.read',
      'notifications.read', 'notifications.update',
    ],
  },
  finanzas: {
    label: 'Finanzas',
    description: 'Ingresos, gastos, cuentas y presupuestos.',
    permissions: [
      'finance.income.read', 'finance.income.create', 'finance.income.void',
      'finance.expenses.read', 'finance.expenses.create', 'finance.expenses.void',
      'finance.accounts.read', 'finance.accounts.create', 'finance.accounts.update', 'finance.accounts.delete',
      'finance.budgets.read', 'finance.budgets.create', 'finance.budgets.update', 'finance.budgets.delete',
      'reports.read', 'reports.export',
      'sales.orders.read', 'purchases.read',
      'notifications.read', 'notifications.update',
    ],
  },
  rrhh: {
    label: 'RRHH',
    description: 'Empleados, departamentos, asistencia y vacaciones.',
    permissions: ['hr.read', 'hr.create', 'hr.update', 'reports.read', 'notifications.read', 'notifications.update'],
  },
  produccion: {
    label: 'Producción',
    description: 'Listas de materiales y órdenes de producción.',
    permissions: ['production.read', 'production.create', 'production.update', 'inventory.read', 'products.read'],
  },
  auditor: {
    label: 'Auditor',
    description: 'Solo lectura profunda: reportes y auditoría.',
    permissions: [
      'audit.read', 'reports.read', 'reports.export',
      'users.read', 'roles.read', 'branches.read',
      'products.read', 'inventory.read', 'warehouses.read',
      'customers.read', 'suppliers.read', 'sales.orders.read', 'purchases.read',
      'finance.income.read', 'finance.expenses.read', 'finance.accounts.read',
      'notifications.read',
    ],
  },
  consulta: {
    label: 'Consulta',
    description: 'Lectura básica de módulos operativos.',
    permissions: [
      'products.read', 'inventory.read', 'warehouses.read',
      'customers.read', 'suppliers.read',
      'sales.orders.read', 'purchases.read',
      'reports.read', 'notifications.read',
    ],
  },
};

function isValidPermission(code) {
  return ALL_PERMISSIONS.includes(code);
}

function isValidPermissionList(list) {
  return Array.isArray(list) && list.every(isValidPermission);
}

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  DEFAULT_ROLES,
  isValidPermission,
  isValidPermissionList,
};
