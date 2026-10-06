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
const Project = require('../modules/projects/project.model');
const CostCenter = require('../modules/cost-centers/cost_center.model');
const Bom = require('../modules/production/bom.model');

const DEMO_COMPANY_NAME = 'Empresa Constructora Tec[ode';
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
  let company = await Company.findOne({ $or: [{ name: DEMO_COMPANY_NAME }, { name: 'Empresa Demo S.A.' }] });
  if (!company) {
    company = await Company.create({
      name: DEMO_COMPANY_NAME,
      legalName: 'Empresa Constructora Tec[ode S.A. de C.V.',
      taxId: 'TEC260930AAA',
      email: 'contacto@teccode.com',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
      status: 'active',
    });
    console.log(`[seed] Empresa constructora creada: ${company.name}`);
  } else {
    company.name = DEMO_COMPANY_NAME;
    company.legalName = 'Empresa Constructora Tec[ode S.A. de C.V.';
    await company.save();
    console.log(`[seed] Empresa constructora actualizada: ${company.name}`);
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

  // Catálogo Real de Materiales e Insumos de Construcción
  const realMaterials = [
    { sku: 'MAT-001', name: 'Cemento Gris CPC 30R 50 kg', unit: 'Saco', costPrice: 220.0, salePrice: 260.0, minStock: 50, maxStock: 2000 },
    { sku: 'MAT-002', name: 'Varilla Corrugada 1/2" Grado 42 (12m)', unit: 'Pieza', costPrice: 185.0, salePrice: 215.0, minStock: 100, maxStock: 5000 },
    { sku: 'MAT-003', name: 'Varilla Corrugada 3/8" Grado 42 (12m)', unit: 'Pieza', costPrice: 110.0, salePrice: 135.0, minStock: 100, maxStock: 5000 },
    { sku: 'MAT-004', name: 'Arena de Mina Cernida para Obra', unit: 'm³', costPrice: 380.0, salePrice: 450.0, minStock: 20, maxStock: 500 },
    { sku: 'MAT-005', name: 'Grava Caliza de 3/4"', unit: 'm³', costPrice: 420.0, salePrice: 490.0, minStock: 20, maxStock: 500 },
    { sku: 'MAT-006', name: 'Mortero Seco de Alta Adherencia 50 kg', unit: 'Saco', costPrice: 165.0, salePrice: 195.0, minStock: 30, maxStock: 1000 },
    { sku: 'MAT-007', name: 'Malla Electrosoldada 6x6-10/10 (2.5x40m)', unit: 'Rollo', costPrice: 1450.0, salePrice: 1750.0, minStock: 5, maxStock: 100 },
    { sku: 'MAT-008', name: 'Tabique Rojo Recocido 7x12x24 cm', unit: 'Millar', costPrice: 3200.0, salePrice: 3800.0, minStock: 2, maxStock: 50 },
    { sku: 'MAT-009', name: 'Block de Concreto Hueco 15x20x40 cm', unit: 'Pieza', costPrice: 16.5, salePrice: 20.0, minStock: 500, maxStock: 10000 },
    { sku: 'MAT-010', name: "Concreto Premezclado f'c=250 kg/cm³", unit: 'm³', costPrice: 1850.0, salePrice: 2200.0, minStock: 10, maxStock: 200 },
    { sku: 'MAT-011', name: 'Pintura Vinílica Industrial Blanca 19L', unit: 'Cubeta', costPrice: 890.0, salePrice: 1100.0, minStock: 10, maxStock: 200 },
    { sku: 'MAT-012', name: 'Yeso de Construcción Blanco 40 kg', unit: 'Saco', costPrice: 95.0, salePrice: 120.0, minStock: 20, maxStock: 500 },
    { sku: 'MAT-013', name: 'Tubo PVC Hidráulico 2" x 6m', unit: 'Pieza', costPrice: 210.0, salePrice: 260.0, minStock: 15, maxStock: 300 },
    { sku: 'MAT-014', name: 'Alambre Recocido Calibre 16', unit: 'kg', costPrice: 38.0, salePrice: 48.0, minStock: 50, maxStock: 1000 },
    { sku: 'MAT-015', name: 'Clavo de Olor 2 1/2" con Cabeza', unit: 'kg', costPrice: 42.0, salePrice: 52.0, minStock: 30, maxStock: 500 }
  ];

  for (const item of realMaterials) {
    if (!(await Product.findOne({ companyId: company._id, sku: item.sku }))) {
      await Product.create({
        companyId: company._id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        costPrice: item.costPrice,
        salePrice: item.salePrice,
        taxRate: 16,
        minStock: item.minStock,
        maxStock: item.maxStock,
        status: 'active',
      });
    }
  }
  console.log(`[seed] Catálogo de ${realMaterials.length} materiales de construcción verificado.`);
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
    adminUser.status = 'active';
    adminUser.failedLoginAttempts = 0;
    adminUser.passwordHash = await hashPassword(password);
    await adminUser.save();
    console.log(`[seed] Administrador demo (${DEMO_ADMIN_EMAIL}): desbloqueado, contraseña sincronizada y activo.`);
  }

  // --- Obras Reales ERP Constructor ---
  const realProjects = [
    { code: 'OBRA-001', name: 'Torre Residencial Coyoacán', location: 'Av. Universidad 1420, Coyoacán, CDMX', budget: 12500000.0, executedAmount: 6200000.0, managerName: 'Ing. Carlos Mendoza', status: 'EN_PROCESO' },
    { code: 'OBRA-002', name: 'Pavimentación y Drenaje Av. Reforma', location: 'Av. Juárez y Paseo de la Reforma, CDMX', budget: 8400000.0, executedAmount: 2100000.0, managerName: 'Ing. Sofia Ramírez', status: 'EN_PROCESO' },
    { code: 'OBRA-003', name: 'Complejo Industrial Toluca', location: 'Parque Industrial Toluca 2000, MEX', budget: 24000000.0, executedAmount: 11500000.0, managerName: 'Ing. Roberto Gómez', status: 'EN_PROCESO' },
    { code: 'OBRA-004', name: 'Hospital General Sur', location: 'Calzada de Tlalpan 4800, CDMX', budget: 18200000.0, executedAmount: 4300000.0, managerName: 'Ing. Fernando Castro', status: 'EN_PROCESO' },
    { code: 'OBRA-005', name: 'Centro Comercial Perisur', location: 'Anillo Periférico Sur 4690, CDMX', budget: 32000000.0, executedAmount: 8900000.0, managerName: 'Ing. Andrea Morales', status: 'EN_PROCESO' }
  ];

  for (const item of realProjects) {
    if (!(await Project.findOne({ companyId: company._id, code: item.code }))) {
      await Project.create({
        companyId: company._id,
        code: item.code,
        name: item.name,
        location: item.location,
        budget: item.budget,
        executedAmount: item.executedAmount,
        status: item.status,
        managerName: item.managerName,
        startDate: new Date('2026-01-15'),
        estimatedEndDate: new Date('2026-12-20'),
      });
    }
  }
  console.log(`[seed] ${realProjects.length} obras reales de construcción creadas.`);
      managerName: 'Ing. Sofia Ramírez',
      startDate: new Date('2026-03-01'),
      estimatedEndDate: new Date('2027-02-28'),
    });
    console.log(`[seed] Obra demo creada: ${p2.code} - ${p2.name}`);
  }

  // Centros de Costo
  let cc1 = await CostCenter.findOne({ companyId: company._id, projectId: p1._id, code: 'CC-MAT-01' });
  if (!cc1) {
    await CostCenter.create({
      companyId: company._id,
      projectId: p1._id,
      code: 'CC-MAT-01',
      name: 'Partida Materiales y Estructura',
      category: 'MATERIALES',
      budget: 1000000.0,
      executedAmount: 550000.0,
    });
    await CostCenter.create({
      companyId: company._id,
      projectId: p1._id,
      code: 'CC-MOB-01',
      name: 'Partida Mano de Obra y Cuadrillas',
      category: 'MANO_DE_OBRA',
      budget: 500000.0,
      executedAmount: 270000.0,
    });
    console.log(`[seed] Centros de costo demo creados para ${p1.code}`);
  }

  return { company, adminUser };
}

async function runSeed(options = {}) {
  const password = env.seed.adminPassword || '19042006uri';
  const platformRole = await ensurePlatformRole();
  await ensureSuperAdmin(platformRole, password);
  if (options.withDemo !== false) {
    await ensureDemoTenant(password);
  }
}

if (require.main === module) {
  const password = requireSeedPassword();
  connectDatabase()
    .then(async () => {
      const platformRole = await ensurePlatformRole();
      await ensureSuperAdmin(platformRole, password);
      if (withDemo) await ensureDemoTenant(password);
      console.log('[seed] Semilla completada.');
    })
    .finally(() => disconnectDatabase())
    .catch((err) => {
      console.error('[seed] Error:', err.message);
      process.exit(1);
    });
}

module.exports = { runSeed };
