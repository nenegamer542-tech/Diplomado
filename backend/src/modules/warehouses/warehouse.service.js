'use strict';

const ApiError = require('../../utils/ApiError');
const warehouseRepository = require('./warehouse.repository');
const stockLevelRepository = require('../inventory/stock_level.repository');
const inventoryMovementRepository = require('../inventory/inventory_movement.repository');

/**
 * Servicio de almacenes — multiempresa estricto: companyId SIEMPRE del token.
 * Un ID ajeno en la URL/body => 404 (nunca 403).
 */
const warehouseService = {
  async list(filter, options) {
    return warehouseRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return warehouseRepository.findById(id, { companyId });
  },

  async create(data, companyId) {
    const code = String(data.code).toUpperCase();
    const existing = await warehouseRepository.findByCode(companyId, code);
    if (existing) {
      throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
    }

    if (data.isDefault === true) await warehouseRepository.clearDefault(companyId);

    return warehouseRepository.create({
      ...data,
      code,
      branchId: data.branchId || null,
      companyId,
    });
  },

  async update(id, data, companyId) {
    const warehouse = await warehouseRepository.findById(id, { companyId });
    if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');

    const patch = { ...data };
    if (patch.code) {
      const code = String(patch.code).toUpperCase();
      const existing = await warehouseRepository.findByCode(companyId, code);
      if (existing && String(existing._id) !== id) {
        throw ApiError.conflict('Ya existe un registro con ese valor en: code.', { fields: ['code'] });
      }
      patch.code = code;
    }
    if (warehouse.isDefault && data.isDefault === false) {
      throw ApiError.conflict(
        'El almacén predeterminado no puede quitarse: marque otro como predeterminado.'
      );
    }
    if (data.isDefault === true) await warehouseRepository.clearDefault(companyId);

    return warehouseRepository.updateById(id, patch, { companyId });
  },

  /**
   * Guardas de borrado físico:
   *  - no el predeterminado,
   *  - no el único almacén,
   *  - sin existencias (> 0) en él,
   *  - sin movimientos (histórico) que lo referencien.
   */
  async remove(id, companyId) {
    const warehouse = await warehouseRepository.findById(id, { companyId });
    if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
    if (warehouse.isDefault) throw ApiError.conflict('No puede eliminar el almacén predeterminado.');

    const total = await warehouseRepository.countByCompany(companyId);
    if (total <= 1) throw ApiError.conflict('No puede eliminar el único almacén de la empresa.');

    const hasStock = await stockLevelRepository.hasStockInWarehouse(companyId, id);
    if (hasStock) throw ApiError.conflict('El almacén tiene existencias: no se puede eliminar.');

    const movements = await inventoryMovementRepository.exists({
      companyId,
      $or: [{ warehouseId: id }, { toWarehouseId: id }],
    });
    if (movements) throw ApiError.conflict('El almacén tiene movimientos de inventario: no se puede eliminar.');

    return warehouseRepository.deleteById(id, { companyId });
  },
};

module.exports = warehouseService;
