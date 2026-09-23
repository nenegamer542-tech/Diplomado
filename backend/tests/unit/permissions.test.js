'use strict';

/**
 * Integridad del catálogo de permisos (fuente de verdad RBAC, ADR-002).
 * Si alguien edita permissions.js y rompe una regla, esta suite lo detecta.
 */

const {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  DEFAULT_ROLES,
  isValidPermission,
  isValidPermissionList,
} = require('../../src/config/permissions');

describe('Catálogo de permisos', () => {
  test('ALL_PERMISSIONS no tiene duplicados', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  test('todo permiso tiene formato modulo.recurso.accion', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p).toMatch(/^[a-z][a-z0-9_.]*$/);
    }
  });

  test('PERMISSIONS y ALL_PERMISSIONS son coherentes', () => {
    const fromGroups = Object.values(PERMISSIONS).flat();
    expect([...fromGroups].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  test('los permisos de plataforma existen en el catálogo', () => {
    for (const p of PLATFORM_PERMISSIONS) {
      expect(isValidPermission(p)).toBe(true);
    }
  });

  test('isValidPermission rechaza códigos inventados', () => {
    expect(isValidPermission('hacker.everything')).toBe(false);
    expect(isValidPermissionList([...ALL_PERMISSIONS, 'fake.perm'])).toBe(false);
  });
});

describe('Roles semilla (DEFAULT_ROLES)', () => {
  test('existen los 10 roles base y todos con permisos válidos', () => {
    expect(Object.keys(DEFAULT_ROLES)).toHaveLength(10);
    for (const [code, cfg] of Object.entries(DEFAULT_ROLES)) {
      expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(cfg.label).toBeTruthy();
      expect(Array.isArray(cfg.permissions)).toBe(true);
      expect(cfg.permissions.length).toBeGreaterThan(0);
      expect(isValidPermissionList(cfg.permissions)).toBe(true);
    }
  });

  test('administrador NO puede crear ni borrar empresas (rol de plataforma)', () => {
    expect(DEFAULT_ROLES.administrador.permissions).not.toContain('companies.create');
    expect(DEFAULT_ROLES.administrador.permissions).not.toContain('companies.delete');
    // ...pero sí leer/actualizar su propia empresa.
    expect(DEFAULT_ROLES.administrador.permissions).toContain('companies.read');
    expect(DEFAULT_ROLES.administrador.permissions).toContain('companies.update');
  });

  test('rol consulta es de SOLO lectura', () => {
    const writes = DEFAULT_ROLES.consulta.permissions.filter((p) => !p.endsWith('.read'));
    expect(writes).toEqual([]);
  });

  test('roles restringidos no escalan: ventas no administra usuarios ni roles', () => {
    for (const code of ['ventas', 'compras', 'almacen', 'consulta']) {
      const perms = DEFAULT_ROLES[code].permissions;
      expect(perms.some((p) => p.startsWith('users.'))).toBe(false);
      expect(perms.some((p) => p.startsWith('roles.'))).toBe(false);
      expect(perms).not.toContain('companies.delete');
    }
  });
});

describe('Permisos de inventario (FASE 3)', () => {
  test('grupos PRODUCTS, WAREHOUSES e INVENTORY completos (lectura + escritura)', () => {
    expect(PERMISSIONS.PRODUCTS).toEqual([
      'products.read',
      'products.create',
      'products.update',
      'products.delete',
    ]);
    expect(PERMISSIONS.WAREHOUSES).toEqual([
      'warehouses.read',
      'warehouses.create',
      'warehouses.update',
      'warehouses.delete',
    ]);
    expect(PERMISSIONS.INVENTORY).toEqual([
      'inventory.read',
      'inventory.movements.create',
      'inventory.transfers.create',
      'inventory.adjustments.create',
    ]);
  });

  test('administrador cubre todo el inventario (menos gestión de empresas)', () => {
    const perms = DEFAULT_ROLES.administrador.permissions;
    for (const p of [...PERMISSIONS.PRODUCTS, ...PERMISSIONS.WAREHOUSES, ...PERMISSIONS.INVENTORY]) {
      expect(perms).toContain(p);
    }
  });

  test('lectores de almacén: gerente, almacen, auditor y consulta (el resto no)', () => {
    for (const code of ['gerente', 'almacen', 'auditor', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).toContain('warehouses.read');
    }
    for (const code of ['ventas', 'compras', 'finanzas', 'rrhh', 'produccion']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('warehouses.read');
    }
  });

  test('sólo almacen (y admin) crean movimientos, ajustes y transferencias', () => {
    const writers = ['inventory.movements.create', 'inventory.adjustments.create', 'inventory.transfers.create'];
    for (const p of writers) {
      expect(DEFAULT_ROLES.almacen.permissions).toContain(p);
      expect(DEFAULT_ROLES.administrador.permissions).toContain(p);
      for (const code of ['gerente', 'ventas', 'compras', 'consulta', 'auditor', 'produccion']) {
        expect(DEFAULT_ROLES[code].permissions).not.toContain(p);
      }
    }
  });

  test('nadie crea productos salvo administrador (roles operativos sólo lectura de catálogo)', () => {
    for (const code of ['gerente', 'ventas', 'compras', 'almacen', 'consulta', 'auditor', 'produccion']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('products.create');
      expect(DEFAULT_ROLES[code].permissions).toContain('products.read');
    }
  });
});

describe('Permisos de compras/ventas (FASE 4)', () => {
  test('grupos PURCHASES, SUPPLIERS, SALES y CUSTOMERS completos', () => {
    expect(PERMISSIONS.PURCHASES).toEqual([
      'purchases.read',
      'purchases.create',
      'purchases.update',
      'purchases.approve',
    ]);
    expect(PERMISSIONS.SUPPLIERS).toEqual([
      'suppliers.read',
      'suppliers.create',
      'suppliers.update',
      'suppliers.delete',
    ]);
    expect(PERMISSIONS.SALES).toEqual([
      'sales.orders.read',
      'sales.orders.create',
      'sales.orders.update',
      'sales.orders.approve',
    ]);
    expect(PERMISSIONS.CUSTOMERS).toEqual([
      'customers.read',
      'customers.create',
      'customers.update',
      'customers.delete',
    ]);
  });

  test('aprueban documentos: administrador y gerente (nadie más)', () => {
    for (const p of ['purchases.approve', 'sales.orders.approve']) {
      expect(DEFAULT_ROLES.administrador.permissions).toContain(p);
      expect(DEFAULT_ROLES.gerente.permissions).toContain(p);
      for (const code of ['ventas', 'compras', 'almacen', 'finanzas', 'rrhh', 'produccion', 'auditor', 'consulta']) {
        expect(DEFAULT_ROLES[code].permissions).not.toContain(p);
      }
    }
  });

  test('compras crea órdenes pero no aprueba; ventas crea pedidos pero no aprueba', () => {
    expect(DEFAULT_ROLES.compras.permissions).toContain('purchases.create');
    expect(DEFAULT_ROLES.compras.permissions).not.toContain('purchases.approve');
    expect(DEFAULT_ROLES.ventas.permissions).toContain('sales.orders.create');
    expect(DEFAULT_ROLES.ventas.permissions).not.toContain('sales.orders.approve');
  });

  test('catálogos maestros: quién crea proveedores/clientes', () => {
    expect(DEFAULT_ROLES.compras.permissions).toContain('suppliers.create');
    expect(DEFAULT_ROLES.ventas.permissions).toContain('customers.create');
    for (const code of ['gerente', 'auditor', 'consulta', 'almacen', 'finanzas', 'rrhh', 'produccion']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('suppliers.create');
      expect(DEFAULT_ROLES[code].permissions).not.toContain('customers.create');
    }
  });

  test('roles de solo lectura de documentos: gerente, finanzas, auditor y consulta', () => {
    for (const code of ['gerente', 'finanzas', 'auditor', 'consulta']) {
      const perms = DEFAULT_ROLES[code].permissions;
      expect(perms).toContain('purchases.read');
      expect(perms).toContain('sales.orders.read');
      expect(perms).not.toContain('purchases.create');
      expect(perms).not.toContain('sales.orders.create');
    }
  });
});

describe('Permisos de finanzas/reportes (FASE 5)', () => {
  test('grupo FINANCE completo: dinero append-only + CRUD de cuentas/presupuestos', () => {
    expect(PERMISSIONS.FINANCE).toEqual([
      'finance.income.read', 'finance.income.create', 'finance.income.void',
      'finance.expenses.read', 'finance.expenses.create', 'finance.expenses.void',
      'finance.accounts.read', 'finance.accounts.create', 'finance.accounts.update', 'finance.accounts.delete',
      'finance.budgets.read', 'finance.budgets.create', 'finance.budgets.update', 'finance.budgets.delete',
    ]);
    expect(PERMISSIONS.REPORTS).toEqual(['reports.read', 'reports.export']);
  });

  test('sólo administrador y finanzas gestionan dinero (nadie más escribe)', () => {
    const writers = [
      'finance.income.create', 'finance.income.void',
      'finance.expenses.create', 'finance.expenses.void',
      'finance.accounts.create', 'finance.accounts.delete',
      'finance.budgets.create', 'finance.budgets.delete',
    ];
    for (const p of writers) {
      expect(DEFAULT_ROLES.administrador.permissions).toContain(p);
      expect(DEFAULT_ROLES.finanzas.permissions).toContain(p);
      for (const code of ['gerente', 'ventas', 'compras', 'almacen', 'rrhh', 'produccion', 'auditor', 'consulta']) {
        expect(DEFAULT_ROLES[code].permissions).not.toContain(p);
      }
    }
  });

  test('lectura de finanzas: gerente y auditor leen (sin .void); operativos y consulta no', () => {
    for (const code of ['gerente', 'auditor']) {
      const perms = DEFAULT_ROLES[code].permissions;
      expect(perms).toContain('finance.income.read');
      expect(perms).toContain('finance.accounts.read');
      expect(perms.some((p) => p.endsWith('.void'))).toBe(false);
      expect(perms.some((p) => p.startsWith('finance.') && p.endsWith('.delete'))).toBe(false);
    }
    for (const code of ['ventas', 'compras', 'almacen', 'rrhh', 'produccion', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('finance.income.read');
      expect(DEFAULT_ROLES[code].permissions).not.toContain('finance.accounts.read');
    }
  });

  test('presupuestos: gerente sólo lee; finanzas los administra; auditor/consulta no', () => {
    expect(DEFAULT_ROLES.gerente.permissions).toContain('finance.budgets.read');
    expect(DEFAULT_ROLES.gerente.permissions).not.toContain('finance.budgets.create');
    expect(DEFAULT_ROLES.gerente.permissions).not.toContain('finance.budgets.update');
    expect(DEFAULT_ROLES.finanzas.permissions).toContain('finance.budgets.create');
    expect(DEFAULT_ROLES.finanzas.permissions).toContain('finance.budgets.update');
    expect(DEFAULT_ROLES.auditor.permissions).not.toContain('finance.budgets.read');
    expect(DEFAULT_ROLES.consulta.permissions).not.toContain('finance.budgets.read');
  });

  test('reportes: lectura amplia; export sólo administrador/finanzas/gerente/auditor', () => {
    for (const code of ['administrador', 'gerente', 'ventas', 'compras', 'finanzas', 'rrhh', 'auditor', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).toContain('reports.read');
    }
    for (const code of ['almacen', 'produccion']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('reports.read');
    }
    for (const code of ['administrador', 'finanzas', 'gerente', 'auditor']) {
      expect(DEFAULT_ROLES[code].permissions).toContain('reports.export');
    }
    for (const code of ['ventas', 'compras', 'almacen', 'rrhh', 'produccion', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('reports.export');
    }
  });
});

describe('Permisos de CRM/RRHH/producción (FASE 6)', () => {
  test('grupos CRM, HR y PRODUCTION completos y SIN .delete (baja por estado, ADR-012)', () => {
    expect(PERMISSIONS.CRM).toEqual(['crm.read', 'crm.create', 'crm.update']);
    expect(PERMISSIONS.HR).toEqual(['hr.read', 'hr.create', 'hr.update']);
    expect(PERMISSIONS.PRODUCTION).toEqual([
      'production.read',
      'production.create',
      'production.update',
    ]);
    for (const group of [PERMISSIONS.CRM, PERMISSIONS.HR, PERMISSIONS.PRODUCTION]) {
      expect(group.some((p) => p.endsWith('.delete'))).toBe(false);
    }
  });

  test('crm: escribe ventas (y admin); lee además gerente; el resto no', () => {
    for (const p of PERMISSIONS.CRM) {
      expect(DEFAULT_ROLES.administrador.permissions).toContain(p);
      expect(DEFAULT_ROLES.ventas.permissions).toContain(p);
    }
    expect(DEFAULT_ROLES.gerente.permissions).toContain('crm.read');
    expect(DEFAULT_ROLES.gerente.permissions).not.toContain('crm.create');
    for (const code of ['compras', 'almacen', 'finanzas', 'rrhh', 'produccion', 'auditor', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('crm.read');
      expect(DEFAULT_ROLES[code].permissions).not.toContain('crm.create');
    }
  });

  test('hr: escribe rrhh (y admin); lee además gerente; el resto no', () => {
    for (const p of PERMISSIONS.HR) {
      expect(DEFAULT_ROLES.administrador.permissions).toContain(p);
      expect(DEFAULT_ROLES.rrhh.permissions).toContain(p);
    }
    expect(DEFAULT_ROLES.gerente.permissions).toContain('hr.read');
    expect(DEFAULT_ROLES.gerente.permissions).not.toContain('hr.create');
    for (const code of ['ventas', 'compras', 'almacen', 'finanzas', 'produccion', 'auditor', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('hr.read');
      expect(DEFAULT_ROLES[code].permissions).not.toContain('hr.create');
    }
  });

  test('producción: escribe produccion (y admin); gerente ni auditor leen producción', () => {
    for (const p of PERMISSIONS.PRODUCTION) {
      expect(DEFAULT_ROLES.administrador.permissions).toContain(p);
      expect(DEFAULT_ROLES.produccion.permissions).toContain(p);
    }
    for (const code of ['gerente', 'ventas', 'compras', 'almacen', 'finanzas', 'rrhh', 'auditor', 'consulta']) {
      expect(DEFAULT_ROLES[code].permissions).not.toContain('production.read');
      expect(DEFAULT_ROLES[code].permissions).not.toContain('production.create');
    }
  });

  test('roles FASE 6 no escalan: produccion con lectura de inventario, rrhh sin dinero', () => {
    expect(DEFAULT_ROLES.produccion.permissions).toContain('inventory.read');
    expect(DEFAULT_ROLES.produccion.permissions).toContain('products.read');
    expect(DEFAULT_ROLES.produccion.permissions.some((p) => p.startsWith('users.'))).toBe(false);
    expect(DEFAULT_ROLES.produccion.permissions.some((p) => p.startsWith('roles.'))).toBe(false);
    expect(DEFAULT_ROLES.rrhh.permissions.some((p) => p.startsWith('finance.'))).toBe(false);
    expect(DEFAULT_ROLES.ventas.permissions).not.toContain('hr.create');
  });
});
