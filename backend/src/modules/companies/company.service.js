'use strict';

const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { DEFAULT_ROLES } = require('../../config/permissions');
const companyRepository = require('./company.repository');
const branchRepository = require('../branches/branch.repository');
const roleRepository = require('../roles/role.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');

/** Sucursal predeterminada creada junto a cada empresa nueva. */
const DEFAULT_BRANCH = {
  code: 'MAIN',
  name: 'Principal',
  isDefault: true,
  status: 'active',
};

/** Almacén predeterminado (FASE 3): todo stock referencia un warehouse. */
const DEFAULT_WAREHOUSE = {
  code: 'MAIN',
  name: 'Almacén General',
  isDefault: true,
  status: 'active',
};

const DEFAULT_SETTINGS = Object.freeze({
  locale: 'es-MX',
  dateFormat: 'DD/MM/YYYY',
  fiscalYearStartMonth: 1,
});

function safeSettings(settings = {}) {
  return {
    locale: ['es-MX', 'en-US'].includes(settings.locale) ? settings.locale : DEFAULT_SETTINGS.locale,
    dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(settings.dateFormat)
      ? settings.dateFormat
      : DEFAULT_SETTINGS.dateFormat,
    fiscalYearStartMonth:
      Number.isInteger(settings.fiscalYearStartMonth) &&
      settings.fiscalYearStartMonth >= 1 &&
      settings.fiscalYearStartMonth <= 12
        ? settings.fiscalYearStartMonth
        : DEFAULT_SETTINGS.fiscalYearStartMonth,
  };
}

/**
 * Servicio de empresas (tenant raíz).
 *
 * Reglas:
 *  - Un usuario solo ve/edita SU empresa (anti-enumeración: 404, no 403).
 *  - El Super Admin de plataforma opera sobre cualquier empresa.
 *  - El estado (suspensión) sólo lo maneja plataforma.
 *  - DELETE = borrado lógico (status 'suspended'); la purga física es un
 *    proceso batch futuro (documentado en docs/database/README.md).
 */
const companyService = {
  async getSettings(companyId) {
    const company = await companyRepository.findById(companyId);
    if (!company) throw ApiError.notFound('Recurso no encontrado.');
    return safeSettings(company.settings);
  },

  async updateSettings(companyId, patch) {
    const company = await companyRepository.updateSettings(companyId, patch);
    if (!company) throw ApiError.notFound('Recurso no encontrado.');
    return safeSettings(company.settings);
  },

  async list(filter, options) {
    return companyRepository.find(filter, options);
  },

  /** Devuelve null si el recurso no existe O no pertenece al actor. */
  async getById(id, actor) {
    const company = await companyRepository.findById(id);
    if (!company) return null;
    if (actor?.isPlatformAdmin) return company;
    if (actor?.companyId && String(company._id) === String(actor.companyId)) return company;
    return null;
  },

  async getOwn(companyId) {
    return companyRepository.findById(companyId);
  },

  /**
   * Crea la empresa y la aprovisiona: sucursal predeterminada + almacén MAIN
   * + roles semilla. Si el aprovisionamiento falla, se revierte la creación
   * (mejor esfuerzo) para no dejar una empresa "vacía" a medias.
   * Los duplicados (código 11000) se traducen en errorHandler con el
   * mensaje canónico "Ya existe un registro con ese valor en: ...".
   */
  async create(data) {
    // Chequeo previo determinista: el índice unique de `name` es el respaldo
    // (puede no existir aún en la primera ejecución, mientras Mongo construye índices).
    const existing = await companyRepository.findOne({ name: data.name });
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: name.', {
        fields: ['name'],
      });
    }

    const company = await companyRepository.create({ ...data, status: 'active' });

    let branch = null;
    let warehouse = null;
    const roles = [];
    try {
      branch = await branchRepository.create({ companyId: company._id, ...DEFAULT_BRANCH });
      warehouse = await warehouseRepository.create({
        companyId: company._id,
        branchId: branch._id,
        ...DEFAULT_WAREHOUSE,
      });

      roles.push(
        ...(await Promise.all(
          Object.entries(DEFAULT_ROLES).map(([code, cfg]) =>
            roleRepository.create({
              companyId: company._id,
              code,
              label: cfg.label,
              description: cfg.description,
              permissions: [...cfg.permissions],
              isSystem: true,
              status: 'active',
            })
          )
        ))
      );

      return { company, branch, warehouse, roles };
    } catch (err) {
      logger.error(
        { err: err.message, companyId: String(company._id) },
        'Aprovisionamiento de empresa falló; se revierte la creación'
      );

      const rollbackOps = [
        companyRepository.deleteById(company._id),
        ...(branch ? [branchRepository.deleteById(branch._id, { companyId: company._id })] : []),
        ...(warehouse
          ? [warehouseRepository.deleteById(warehouse._id, { companyId: company._id })]
          : []),
        ...roles.map((r) => roleRepository.deleteById(r._id, { companyId: company._id })),
      ];
      const results = await Promise.allSettled(rollbackOps);
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) {
        logger.error({ failed: failed.length }, 'Rollback incompleto al aprovisionar empresa');
      }
      throw err;
    }
  },

  async update(id, data, actor) {
    const company = await companyRepository.findById(id);
    if (!company) throw ApiError.notFound('Recurso no encontrado.');

    const isPlatform = actor?.isPlatformAdmin === true;
    const isOwner = actor?.companyId && String(company._id) === String(actor.companyId);
    if (!isPlatform && !isOwner) throw ApiError.notFound('Recurso no encontrado.');

    const patch = { ...data };
    if (!isPlatform) delete patch.status; // suspensión: sólo plataforma

    return companyRepository.updateById(id, patch);
  },

  /** Borrado lógico (suspensión) — sólo plataforma. */
  async remove(id, actor) {
    const company = await companyRepository.findById(id);
    if (!company) throw ApiError.notFound('Recurso no encontrado.');
    if (!actor?.isPlatformAdmin) {
      throw ApiError.forbidden('Operación reservada al administrador de plataforma.');
    }
    return companyRepository.updateById(id, { status: 'suspended' });
  },
};

module.exports = companyService;
