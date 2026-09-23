'use strict';

/**
 * Validación Zod de FASE 6 (CRM/RRHH):
 * leads con ciclo de vida por estado y empleados con documento único.
 * Sin `.delete` en ningún módulo (ADR-012).
 */

const leadSchemas = require('../../src/modules/crm/lead.validation');
const employeeSchemas = require('../../src/modules/hr/employee.validation');

const USER_ID = '64b000000000000000000301';

describe('Lead CRM — createSchema', () => {
  test('payload mínimo y completo pasan (email se normaliza)', () => {
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana Pérez' }).success).toBe(true);

    const full = leadSchemas.createSchema.safeParse({
      name: 'Ana Pérez',
      company: 'ACME',
      email: '  Ana@Example.COM ',
      phone: '5512345678',
      source: 'web',
      status: 'NEW',
      expectedAmount: 1500,
      notes: 'Llamada de introducción',
      assignedTo: USER_ID,
    });
    expect(full.success).toBe(true);
    expect(full.data.email).toBe('ana@example.com');
  });

  test('nombre corto, status/source fuera de enum o importe negativo ⇒ inválido', () => {
    expect(leadSchemas.createSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', status: 'DEAD' }).success).toBe(false);
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', source: 'tiktok' }).success).toBe(false);
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', expectedAmount: -1 }).success).toBe(false);
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', assignedTo: 'no-oid' }).success).toBe(false);
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', email: 'no-email' }).success).toBe(false);
  });

  test('schema estricto: companyId/createdBy del cliente ⇒ inválido', () => {
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', companyId: 'x' }).success).toBe(false);
    expect(leadSchemas.createSchema.safeParse({ name: 'Ana', createdBy: 'x' }).success).toBe(false);
    expect(leadSchemas.CREATE_FIELDS).not.toContain('companyId');
    expect(leadSchemas.CREATE_FIELDS).not.toContain('createdBy');
    // El estado inicial SÍ se acepta (el ciclo lo controla el service).
    expect(leadSchemas.CREATE_FIELDS).toContain('status');
  });

  test('PATCH parcial estricto: vacío ⇒ inválido; status debe respetar el enum', () => {
    expect(leadSchemas.updateSchema.safeParse({ status: 'CONTACTED' }).success).toBe(true);
    expect(leadSchemas.updateSchema.safeParse({ notes: 'Sólo notas' }).success).toBe(true);
    expect(leadSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(leadSchemas.updateSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
    expect(leadSchemas.updateSchema.safeParse({ name: 'Ana', companyId: 'x' }).success).toBe(false);
  });

  test('listQuery: enums de estado/origen y paginación coercida', () => {
    expect(
      leadSchemas.listQuery.safeParse({ status: 'QUALIFIED', source: 'web', page: '2' }).success
    ).toBe(true);
    expect(leadSchemas.listQuery.safeParse({ status: 'PENDING' }).success).toBe(false);
    expect(leadSchemas.listQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('Empleado RRHH — createSchema / updateSchema / listQuery', () => {
  const MINIMAL = { documentId: '12345678A', firstName: 'Ana', lastName: 'García' };

  test('payload mínimo válido (documento, nombre y apellido)', () => {
    expect(employeeSchemas.createSchema.safeParse(MINIMAL).success).toBe(true);
  });

  test('faltan apellidos, documento corto o valores fuera de rango ⇒ inválido', () => {
    expect(employeeSchemas.createSchema.safeParse({ documentId: '12345678A', firstName: 'Ana' }).success).toBe(false);
    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, documentId: '12' }).success).toBe(false);
    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, salary: -1 }).success).toBe(false);
    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, status: 'baja' }).success).toBe(false);
    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, email: 'no-es-email' }).success).toBe(false);
    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, hireDate: 'ayer' }).success).toBe(false);
  });

  test('hireDate se coercece a Date; schema estricto sin companyId/createdBy', () => {
    const result = employeeSchemas.createSchema.safeParse({ ...MINIMAL, hireDate: '2026-01-15' });
    expect(result.success).toBe(true);
    expect(result.data.hireDate).toBeInstanceOf(Date);

    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, companyId: 'x' }).success).toBe(false);
    expect(employeeSchemas.createSchema.safeParse({ ...MINIMAL, createdBy: 'x' }).success).toBe(false);
    expect(employeeSchemas.CREATE_FIELDS).not.toContain('companyId');
    expect(employeeSchemas.CREATE_FIELDS).not.toContain('createdBy');
  });

  test('PATCH parcial estricto no vacío; listQuery con status/department', () => {
    expect(employeeSchemas.updateSchema.safeParse({ status: 'inactive' }).success).toBe(true);
    expect(employeeSchemas.updateSchema.safeParse({}).success).toBe(false);
    expect(employeeSchemas.updateSchema.safeParse({ salary: -5 }).success).toBe(false);
    expect(
      employeeSchemas.listQuery.safeParse({ status: 'active', department: 'Operaciones', page: '3' })
        .success
    ).toBe(true);
    expect(employeeSchemas.listQuery.safeParse({ status: 'baja' }).success).toBe(false);
    expect(employeeSchemas.listQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});
