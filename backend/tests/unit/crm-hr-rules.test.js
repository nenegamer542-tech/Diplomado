'use strict';

/**
 * Reglas de FASE 6 (ADR-012): leads con ciclo de vida por estado (sin DELETE)
 * y empleados con documento único por empresa (baja por status inactive).
 * Multiempresa: ID ajeno ⇒ 404 (nunca 403).
 */

jest.mock('../../src/modules/crm/lead.repository', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../src/modules/users/user.repository', () => ({ findById: jest.fn() }));
jest.mock('../../src/modules/hr/employee.repository', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  find: jest.fn(),
  existsByDocument: jest.fn(),
}));

const leadRepository = require('../../src/modules/crm/lead.repository');
const userRepository = require('../../src/modules/users/user.repository');
const employeeRepository = require('../../src/modules/hr/employee.repository');
const leadService = require('../../src/modules/crm/lead.service');
const employeeService = require('../../src/modules/hr/employee.service');

const COMPANY = '64b00000000000000000000a';
const OTHER = '64b0000000000000000002ff';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('leadService.create — asignación y defaults', () => {
  test('asignación a un usuario de OTRA empresa ⇒ 404 sin crear', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      leadService.create({ name: 'Ana Pérez', assignedTo: OTHER }, COMPANY, 'u1')
    ).rejects.toMatchObject({ statusCode: 404, message: 'Recurso no encontrado.' });
    expect(leadRepository.create).not.toHaveBeenCalled();
  });

  test('crea con defaults NEW/other y asignación válida', async () => {
    userRepository.findById.mockResolvedValue({ _id: 'u9', companyId: COMPANY });
    leadRepository.create.mockResolvedValue({ _id: 'l1', status: 'NEW' });

    const result = await leadService.create(
      { name: 'Ana Pérez', company: 'ACME', assignedTo: 'u9' },
      COMPANY,
      'u1'
    );

    expect(leadRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        name: 'Ana Pérez',
        company: 'ACME',
        status: 'NEW',
        source: 'other',
        expectedAmount: 0,
        assignedTo: 'u9',
        createdBy: 'u1',
      })
    );
    expect(result.status).toBe('NEW');
  });
});

describe('leadService.update — ciclo de vida (ADR-012)', () => {
  test('lead inexistente/ajeno ⇒ 404', async () => {
    leadRepository.findById.mockResolvedValue(null);
    await expect(leadService.update('l1', { notes: 'x' }, COMPANY)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
  });

  test('transición no permitida (NEW → QUALIFIED) ⇒ 409 sin escribir', async () => {
    leadRepository.findById.mockResolvedValue({ _id: 'l1', status: 'NEW' });

    await expect(leadService.update('l1', { status: 'QUALIFIED' }, COMPANY)).rejects.toMatchObject({
      statusCode: 409,
      message: 'La transición de estado no está permitida.',
    });
    expect(leadRepository.updateById).not.toHaveBeenCalled();
  });

  test('transición válida (NEW → CONTACTED) ⇒ actualiza el estado', async () => {
    leadRepository.findById.mockResolvedValue({ _id: 'l1', status: 'NEW' });
    leadRepository.updateById.mockResolvedValue({ _id: 'l1', status: 'CONTACTED' });

    const result = await leadService.update('l1', { status: 'CONTACTED' }, COMPANY);

    expect(leadRepository.updateById).toHaveBeenCalledWith(
      'l1',
      { status: 'CONTACTED' },
      { companyId: COMPANY }
    );
    expect(result.status).toBe('CONTACTED');
  });

  test('enviar el MISMO estado no dispara transición (no-op permitido)', async () => {
    leadRepository.findById.mockResolvedValue({ _id: 'l1', status: 'NEW' });
    leadRepository.updateById.mockResolvedValue({ _id: 'l1', status: 'NEW' });

    await leadService.update('l1', { status: 'NEW' }, COMPANY);

    expect(leadRepository.updateById).toHaveBeenCalledWith('l1', {}, { companyId: COMPANY });
  });

  test('lead cerrado (WON/LOST) ⇒ 409 y no admite cambios', async () => {
    for (const closed of ['WON', 'LOST']) {
      leadRepository.findById.mockResolvedValue({ _id: 'l1', status: closed });
      await expect(leadService.update('l1', { notes: 'x' }, COMPANY)).rejects.toMatchObject({
        statusCode: 409,
        message: 'El lead está cerrado; no admite modificaciones.',
      });
      expect(leadRepository.updateById).not.toHaveBeenCalled();
    }
  });

  test('reasignar a usuario ajeno ⇒ 404 sin escribir', async () => {
    leadRepository.findById.mockResolvedValue({ _id: 'l1', status: 'NEW' });
    userRepository.findById.mockResolvedValue(null);

    await expect(leadService.update('l1', { assignedTo: OTHER }, COMPANY)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
    expect(leadRepository.updateById).not.toHaveBeenCalled();
  });

  test('ningún servicio FASE 6 expone remove/delete (baja por estado)', () => {
    expect(leadService.remove).toBeUndefined();
    expect(employeeService.remove).toBeUndefined();
  });
});

describe('employeeService — documento único y lifecycle', () => {
  const DOC = { documentId: '12345678A', firstName: 'Ana', lastName: 'García' };

  test('create: documento duplicado ⇒ 409 canónico con details.fields', async () => {
    employeeRepository.existsByDocument.mockResolvedValue({ _id: 'other' });

    await expect(employeeService.create(DOC, COMPANY, 'u1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ya existe un registro con ese valor en: documentId.',
      details: { fields: ['documentId'] },
    });
    expect(employeeRepository.create).not.toHaveBeenCalled();
    expect(employeeRepository.existsByDocument).toHaveBeenCalledWith(COMPANY, '12345678A');
  });

  test('create: documento libre ⇒ crea con defaults (salary 0, status active)', async () => {
    employeeRepository.existsByDocument.mockResolvedValue(null);
    employeeRepository.create.mockResolvedValue({ _id: 'e1', documentId: '12345678A' });

    await employeeService.create(DOC, COMPANY, 'u1');

    expect(employeeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        documentId: '12345678A',
        firstName: 'Ana',
        lastName: 'García',
        salary: 0,
        status: 'active',
        createdBy: 'u1',
      })
    );
  });

  test('update: colisión con OTRO empleado ⇒ 409 (excluye el propio)', async () => {
    employeeRepository.findById.mockResolvedValue({ _id: 'e1', documentId: '11111111A' });
    employeeRepository.existsByDocument.mockResolvedValue({ _id: 'other' });

    await expect(
      employeeService.update('e1', { documentId: '22222222B' }, COMPANY)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ya existe un registro con ese valor en: documentId.',
      details: { fields: ['documentId'] },
    });
    expect(employeeRepository.existsByDocument).toHaveBeenCalledWith(
      COMPANY,
      '22222222B',
      'e1'
    );
    expect(employeeRepository.updateById).not.toHaveBeenCalled();
  });

  test('update: conservar el propio documento no consulta unicidad', async () => {
    employeeRepository.findById.mockResolvedValue({ _id: 'e1', documentId: '11111111A' });
    employeeRepository.updateById.mockResolvedValue({ _id: 'e1', firstName: 'Ana' });

    await employeeService.update('e1', { documentId: '11111111A', firstName: 'Ana' }, COMPANY);

    expect(employeeRepository.existsByDocument).not.toHaveBeenCalled();
    expect(employeeRepository.updateById).toHaveBeenCalledWith(
      'e1',
      { documentId: '11111111A', firstName: 'Ana' },
      { companyId: COMPANY }
    );
  });

  test('baja y reactivación por status (lifecycle en lugar de DELETE)', async () => {
    employeeRepository.findById.mockResolvedValue({ _id: 'e1', status: 'active' });
    employeeRepository.updateById.mockResolvedValue({ _id: 'e1', status: 'inactive' });

    await employeeService.update('e1', { status: 'inactive' }, COMPANY);
    expect(employeeRepository.updateById).toHaveBeenCalledWith(
      'e1',
      { status: 'inactive' },
      { companyId: COMPANY }
    );
  });

  test('empleado inexistente/ajeno ⇒ 404', async () => {
    employeeRepository.findById.mockResolvedValue(null);
    await expect(employeeService.update('e1', { notes: 'x' }, COMPANY)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Recurso no encontrado.',
    });
  });
});
