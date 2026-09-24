'use strict';

/**
 * SEMILLA IDEMPOTENTE (FASE 2).
 *
 * Siempre crea (si no existen):
 *   1. Rol de plataforma 'super_admin'.
 *   2. Usuario Super Admin con SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Con --demo crea además:
 *   3. Empresa demo + sucursal MAIN + almacén MAIN + roles semilla +
 *      catálogo demo (producto, proveedor, cliente, cuentas financieras
 *      y FASE 6: producto terminado, BOM, empleado y lead) +
 *      su administrador (admin@demo.example.com con la misma contraseña
 *      semilla).
 *
 * Uso (desde backend/):
 *   npm run seed            → sólo super admin
 *   npm run seed -- --demo  → incluye empresa demo
 *
 * Reglas:
 *   - Idempotente: nunca duplica; NUNCA cambia contraseñas existentes.
 *   - La contraseña semilla debe ser fuerte (>=8, letras y números).
 */

const { connectDatabase, disconnectDatabase } = require('../config/database');
const env = require('../config/env');
const { ALL_PERMISSIONS, DEFAULT_ROLES } = require('../config/permissions');
const { hashPassword, isStrongPassword } = require('../utils/password');
const Company = require('../modules/companies/company.model');
const Branch = require('../modules/branches/branch.model');
const Warehouse = require('../modules/warehouses/warehouse.model');
const Role = require('../modules/roles/role.model');
const Product = require('../modules/products/product.model');
const Supplier = require('../modules/suppliers/supplier.model');
const Customer = require('../modules/customers/customer.model');
const FinanceAccount = require('../modules/accounts/account.model');
const User = require('../modules/users/user.model');
const { nextSequence, formatCode } = require('../common/sequence');
const Lead = require('../modules/crm/lead.model');
const Employee = require('../modules/hr/employee.model');
const Bom = require('../modules/production/bom.model');

const DEMO_COMPANY_NAME = 'Empresa Demo S.A.';
const DEMO_ADMIN_EMAIL = 'admin@demo.example.com';

const withDemo = process.argv.slice(2).includes('--demo');

function requireSeedPassword() {
  if (!env.seed.adminPassword || !isStrongPassword(env.seed.adminPassword)) {
    throw new Error(
      'SEED_ADMIN_PASSWORD no está definida o no es fuerte (>=8 caracteres, letras y números). ' +
        'Configúrala en .env antes de ejecutar la semilla.'
    );
  }
  return env.seed.adminPassword;
}

async function ensurePlatformRole() {
  const existing = await Role.findOne({ companyId: null, code: 'super_admin' });
  if (existing) {
    console.log('[seed] Rol de plataforma super_admin: ya existe.');
    return existing;
  }
  const role = await Role.create({
    companyId: null,
    code: 'super_admin',
    label: 'Super Administrador',
    description: 'Administrador de plataforma: gestiona empresas fuera de cualquier tenant.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    status: 'active',
  });
  console.log('[seed] Rol de plataforma super_admin: creado.');
  return role;
}

async function ensureSuperAdmin(role, password) {
  const existing = await User.findOne({ email: env.seed.adminEmail });
  if (existing) {
    console.log(`[seed] Super Admin (${env.seed.adminEmail}): ya existe; contraseña intacta.`);
    return existing;
  }
  const user = await User.create({
    companyId: null,
    branchId: null,
    roleId: role._id,
    name: 'Super',
    lastName: 'Admin',
    email: env.seed.adminEmail,
    passwordHash: await hashPassword(password),
    status: 'active',
    isPlatformAdmin: true,
  });
  console.log(`[seed] Super Admin creado: ${user.email}`);
  return user;
}

async function ensureDemoTenant(password) {
  let company = await Company.findOne({ name: DEMO_COMPANY_NAME });
  if (!company) {
    company = await Company.create({
      name: DEMO_COMPANY_NAME,
      legalName: 'Empresa Demo Sociedad Anónima',
      taxId: 'XAXX010101000',
      email: 'demo@example.com',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
      status: 'active',
    });
    console.log(`[seed] Empresa demo creada: ${company.name}`);
  } else {
    console.log('[seed] Empresa demo: ya existe.');
  }

  let branch = await Branch.findOne({ companyId: company._id, code: 'MAIN' });
  if (!branch) {
    branch = await Branch.create({
      companyId: company._id,
      code: 'MAIN',
      name: 'Principal',
      isDefault: true,
      status: 'active',
    });
    console.log('[seed] Sucursal MAIN creada.');
  }

  let warehouse = await Warehouse.findOne({ companyId: company._id, code: 'MAIN' });
  if (!warehouse) {
    warehouse = await Warehouse.create({
      companyId: company._id,
      branchId: branch._id,
      code: 'MAIN',
      name: 'Almacén General',
      isDefault: true,
      status: 'active',
    });
    console.log('[seed] Almacén MAIN creado.');
  }

  // Catálogos demo (FASE 3 + 4): producto, proveedor y cliente de ejemplo.
  if (!(await Product.findOne({ companyId: company._id, sku: 'DEMO-001' }))) {
    await Product.create({
      companyId: company._id,
      sku: 'DEMO-001',
      name: 'Producto Demo',
      unit: 'pza',
      costPrice: 10,
      salePrice: 15,
      taxRate: 16,
      minStock: 5,
      status: 'active',
    });
    console.log('[seed] Producto demo DEMO-001 creado.');
  }
  if (!(await Product.findOne({ companyId: company._id, sku: 'DEMO-002' }))) {
    await Product.create({
      companyId: company._id,
      sku: 'DEMO-002',
      name: 'Producto Terminado Demo',
      unit: 'pza',
      costPrice: 25,
      salePrice: 40,
      taxRate: 16,
      minStock: 2,
      status: 'active',
    });
    console.log('[seed] Producto demo DEMO-002 creado.');
  }
  if (!(await Supplier.findOne({ companyId: company._id, code: 'DEMO-PROV' }))) {
    await Supplier.create({
      companyId: company._id,
      code: 'DEMO-PROV',
      name: 'Proveedor Demo',
      email: 'proveedor@demo.example.com',
      status: 'active',
    });
    console.log('[seed] Proveedor demo DEMO-PROV creado.');
  }
  if (!(await Customer.findOne({ companyId: company._id, code: 'DEMO-CLI' }))) {
    await Customer.create({
      companyId: company._id,
      code: 'DEMO-CLI',
      name: 'Cliente Demo',
      email: 'cliente@demo.example.com',
      status: 'active',
    });
    console.log('[seed] Cliente demo DEMO-CLI creado.');
  }

  // Cuentas financieras demo (FASE 5): el saldo sólo lo gestiona el servidor.
  if (!(await FinanceAccount.findOne({ companyId: company._id, code: 'DEMO-CASH' }))) {
    await FinanceAccount.create({
      companyId: company._id,
      code: 'DEMO-CASH',
      name: 'Caja Chica',
      type: 'cash',
      currency: 'MXN',
      balance: 0,
      status: 'active',
    });
    console.log('[seed] Cuenta demo DEMO-CASH creada.');
  }
  if (!(await FinanceAccount.findOne({ companyId: company._id, code: 'DEMO-BANK' }))) {
    await FinanceAccount.create({
      companyId: company._id,
      code: 'DEMO-BANK',
      name: 'Banco Demo',
      type: 'bank',
      currency: 'MXN',
      balance: 0,
      status: 'active',
    });
    console.log('[seed] Cuenta demo DEMO-BANK creada.');
  }

  // Catálogo FASE 6: producto terminado, BOM, empleado y lead demo.
  const finProduct = await Product.findOne({ companyId: company._id, sku: 'DEMO-002' });
  const rawProduct = await Product.findOne({ companyId: company._id, sku: 'DEMO-001' });
  if (
    finProduct &&
    rawProduct &&
    !(await Bom.findOne({ companyId: company._id, productId: finProduct._id }))
  ) {
    // El código sale del MISMO contador que la API (nunca se duplica, ADR-009).
    const seq = await nextSequence(company._id, 'boms');
    await Bom.create({
      companyId: company._id,
      code: formatCode('BOM', seq),
      productId: finProduct._id,
      components: [{ productId: rawProduct._id, quantity: 2 }],
      notes: 'Ensamble demo (FASE 6)',
      status: 'active',
    });
    console.log('[seed] BOM demo creada.');
  }
  if (!(await Employee.findOne({ companyId: company._id, documentId: 'DEMO-EMP-001' }))) {
    await Employee.create({
      companyId: company._id,
      documentId: 'DEMO-EMP-001',
      firstName: 'Elena',
      lastName: 'Demo',
      email: 'rrhh@demo.example.com',
      position: 'Operadora',
      department: 'Producción',
      salary: 12000,
      status: 'active',
    });
    console.log('[seed] Empleado demo DEMO-EMP-001 creado.');
  }
  if (!(await Lead.findOne({ companyId: company._id, email: 'lead@demo.example.com' }))) {
    await Lead.create({
      companyId: company._id,
      name: 'Laura Lead',
      company: 'Prospecto Demo',
      email: 'lead@demo.example.com',
      phone: '5500000000',
      source: 'web',
      status: 'NEW',
      expectedAmount: 5000,
      notes: 'Prospecto de muestra (FASE 6)',
    });
    console.log('[seed] Lead demo creado.');
  }

  const roles = {};
  for (const [code, cfg] of Object.entries(DEFAULT_ROLES)) {
    let role = await Role.findOne({ companyId: company._id, code });
    if (!role) {
      role = await Role.create({
        companyId: company._id,
        code,
        label: cfg.label,
        description: cfg.description,
        permissions: [...cfg.permissions],
        isSystem: true,
        status: 'active',
      });
    } else if (role.isSystem) {
      // Agrega permisos de esta versión sin quitar permisos ya existentes.
      role.permissions = [...new Set([...role.permissions, ...cfg.permissions])];
      await role.save();
    }
    roles[code] = role;
  }
  console.log(`[seed] Roles semilla de empresa: ${Object.keys(roles).join(', ')}`);

  let adminUser = await User.findOne({ email: DEMO_ADMIN_EMAIL });
  if (!adminUser) {
    adminUser = await User.create({
      companyId: company._id,
      branchId: branch._id,
      roleId: roles.administrador._id,
      name: 'Admin',
      lastName: 'Demo',
      email: DEMO_ADMIN_EMAIL,
      passwordHash: await hashPassword(password),
      status: 'active',
      isPlatformAdmin: false,
    });
    console.log(`[seed] Administrador de empresa demo creado: ${adminUser.email}`);
  } else {
    console.log(`[seed] Administrador demo (${DEMO_ADMIN_EMAIL}): ya existe.`);
  }

  return { company, adminUser };
}

async function main() {
  const password = requireSeedPassword();
  await connectDatabase();
  try {
    const platformRole = await ensurePlatformRole();
    await ensureSuperAdmin(platformRole, password);

    if (withDemo) {
      await ensureDemoTenant(password);
    }

    console.log('[seed] Semilla completada.');
    if (withDemo) {
      console.log(`[seed] Login demo: ${DEMO_ADMIN_EMAIL} / <SEED_ADMIN_PASSWORD>`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});
