'use strict';

/**
 * Fixtures de integración: montan tenants reales en MongoDB de test
 * usando los REPOSITORIOS (sin pasar por services, para no acoplar las
 * pruebas al comportamiento que se quiere verificar).
 */

const request = require('supertest');
const app = require('../../src/app');
const { hashPassword } = require('../../src/utils/password');
const { ALL_PERMISSIONS, DEFAULT_ROLES } = require('../../src/config/permissions');
const companyRepository = require('../../src/modules/companies/company.repository');
const branchRepository = require('../../src/modules/branches/branch.repository');
const roleRepository = require('../../src/modules/roles/role.repository');
const userRepository = require('../../src/modules/users/user.repository');
const warehouseRepository = require('../../src/modules/warehouses/warehouse.repository');

/** Empresa + sucursal MAIN + almacén MAIN + los roles semilla. */
async function createTenant({ name = 'Empresa Test' } = {}) {
  const company = await companyRepository.create({ name, status: 'active', currency: 'MXN' });
  const branch = await branchRepository.create({
    companyId: company._id,
    code: 'MAIN',
    name: 'Principal',
    isDefault: true,
    status: 'active',
  });
  const warehouse = await warehouseRepository.create({
    companyId: company._id,
    branchId: branch._id,
    code: 'MAIN',
    name: 'Almacén General',
    isDefault: true,
    status: 'active',
  });

  const roles = {};
  for (const [code, cfg] of Object.entries(DEFAULT_ROLES)) {
    roles[code] = await roleRepository.create({
      companyId: company._id,
      code,
      label: cfg.label,
      description: cfg.description,
      permissions: [...cfg.permissions],
      isSystem: true,
      status: 'active',
    });
  }
  return { company, branch, warehouse, roles };
}

async function createUser({
  company = null,
  branch = null,
  role,
  email,
  password = 'Clave1234',
  name = 'User',
  lastName = 'Test',
  isPlatformAdmin = false,
}) {
  return userRepository.create({
    companyId: company ? company._id : null,
    branchId: branch ? branch._id : null,
    roleId: role._id,
    name,
    lastName,
    email,
    passwordHash: await hashPassword(password),
    status: 'active',
    isPlatformAdmin,
  });
}

/** Super Admin de plataforma (fuera de cualquier tenant). */
async function createPlatformSuperAdmin(email = 'superadmin@test.local') {
  const role = await roleRepository.create({
    companyId: null,
    code: 'super_admin',
    label: 'Super Administrador',
    description: 'Plataforma',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    status: 'active',
  });
  const user = await createUser({
    company: null,
    role,
    email,
    name: 'Super',
    lastName: 'Admin',
    isPlatformAdmin: true,
  });
  return { role, user };
}

/** Login vía API real; devuelve el access token. */
async function login(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
}

/** Cabecera Authorization para supertest. */
function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  createTenant,
  createUser,
  createPlatformSuperAdmin,
  login,
  auth,
};
