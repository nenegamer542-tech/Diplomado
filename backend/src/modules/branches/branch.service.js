'use strict';

const ApiError = require('../../utils/ApiError');
const branchRepository = require('./branch.repository');
const userRepository = require('../users/user.repository');
const warehouseRepository = require('../warehouses/warehouse.repository');
const stockLevelRepository = require('../inventory/stock_level.repository');

/**
 * Servicio de sucursales (multiempresa estricto).
 * Todas las operaciones reciben companyId YA extraído del token (nunca
 * del cliente): manipular el ID en la URL no cruza empresas.
 */
const branchService = {
  async list(filter, options) {
    return branchRepository.find(filter, options);
  },

  async getById(id, companyId) {
    if (!companyId) {
      throw ApiError.forbidden('Operación disponible sólo en contexto de empresa.');
    }
    return branchRepository.findById(id, { companyId });
  },

  async create(data, companyId) {
    // Chequeo previo determinista (el índice unique {companyId, code} es el respaldo).
    // El modelo almacena el código en MAYÚSCULas: se compara igual.
    const code = String(data.code).toUpperCase();
    const existing = await branchRepository.findOne({ companyId, code });
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', {
        fields: ['code'],
      });
    }

    const branch = await branchRepository.create({ ...data, companyId });
    // Si es la nueva predeterminada, se desmarcan las demás (post-create
    // para no perder el flag si esta creación falla por duplicado).
    if (branch.isDefault) await branchRepository.clearDefault(companyId, branch._id);
    return branch;
  },

  async update(id, data, companyId) {
    const branch = await branchRepository.findById(id, { companyId });
    if (!branch) throw ApiError.notFound('Recurso no encontrado.');

    if (branch.isDefault && data.isDefault === false) {
      throw ApiError.conflict(
        'La sucursal predeterminada no puede quitarse: marque otra como predeterminada.'
      );
    }
    if (data.isDefault === true) await branchRepository.clearDefault(companyId, id);

    return branchRepository.updateById(id, data, { companyId });
  },

  async remove(id, companyId) {
    const branch = await branchRepository.findById(id, { companyId });
    if (!branch) throw ApiError.notFound('Recurso no encontrado.');
    if (branch.isDefault) throw ApiError.conflict('No puede eliminar la sucursal predeterminada.');

    const total = await branchRepository.countByCompany(companyId);
    if (total <= 1) throw ApiError.conflict('No puede eliminar la única sucursal de la empresa.');

    const inUse = await userRepository.countByBranch(id);
    if (inUse > 0) {
      throw ApiError.conflict(`La sucursal está en uso por ${inUse} usuario(s).`);
    }

    // FASE 3: una sucursal con existencias no se elimina (los almacenes
    // vinculados conservan stock; el movimiento histórico no se toca).
    const warehouseIds = await warehouseRepository.findIdsByBranch(companyId, id);
    const withStock = await stockLevelRepository.countWithStock(companyId, warehouseIds);
    if (withStock > 0) {
      throw ApiError.conflict(
        'La sucursal tiene almacenes con existencias; transfiera o ajuste el stock antes de eliminarla.'
      );
    }

    // Desvincula los almacenes (no se borran: siguen siendo de la empresa).
    await warehouseRepository.unassignBranch(companyId, id);

    return branchRepository.deleteById(id, { companyId });
  },
};

module.exports = branchService;
