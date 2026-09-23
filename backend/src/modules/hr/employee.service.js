'use strict';

const ApiError = require('../../utils/ApiError');
const employeeRepository = require('./employee.repository');

/**
 * Servicio de RRHH / EMPLEADOS (FASE 6) — multiempresa estricto, sin DELETE.
 *
 * Reglas (ADR-012):
 *  - companyId SALE SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - La baja es un cambio de status a inactive (y la reactivación a active).
 *  - `documentId` es único POR empresa; duplicado => 409 canónico.
 */
const PATCHABLE = [
  'documentId',
  'firstName',
  'lastName',
  'email',
  'position',
  'department',
  'hireDate',
  'salary',
  'status',
  'terminationDate',
  'notes',
];

const employeeService = {
  async list(filter, options) {
    return employeeRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return employeeRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    const duplicate = await employeeRepository.existsByDocument(companyId, data.documentId);
    if (duplicate) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: documentId.', {
        fields: ['documentId'],
      });
    }

    return employeeRepository.create({
      companyId,
      documentId: data.documentId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      position: data.position || null,
      department: data.department || null,
      hireDate: data.hireDate || new Date(),
      salary: data.salary ?? 0,
      status: data.status || 'active',
      terminationDate: data.terminationDate || null,
      notes: data.notes || null,
      createdBy: userId || null,
    });
  },

  async update(id, data, companyId) {
    const employee = await employeeRepository.findById(id, { companyId });
    if (!employee) throw ApiError.notFound('Recurso no encontrado.');

    if (data.documentId !== undefined && data.documentId !== employee.documentId) {
      const duplicate = await employeeRepository.existsByDocument(companyId, data.documentId, id);
      if (duplicate) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: documentId.', {
          fields: ['documentId'],
        });
      }
    }

    const patch = {};
    for (const field of PATCHABLE) {
      if (data[field] !== undefined) patch[field] = data[field];
    }

    return employeeRepository.updateById(id, patch, { companyId });
  },
};

module.exports = employeeService;
