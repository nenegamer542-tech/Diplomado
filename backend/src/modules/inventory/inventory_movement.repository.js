'use strict';

const BaseRepository = require('../../common/BaseRepository');
const InventoryMovement = require('./inventory_movement.model');

/**
 * Repositorio de movimientos de inventario — tenant: companyId obligatorio.
 * Sólo creación (append-only): no hay updateById/deleteById en la API.
 */
class InventoryMovementRepository extends BaseRepository {
  constructor() {
    super(InventoryMovement, { requireTenant: true });
  }

  async findByReference(companyId, reference) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, reference }).lean();
  }

  async findByIdempotencyKey(companyId, idempotencyKey) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, idempotencyKey }).lean();
  }
}

module.exports = new InventoryMovementRepository();
