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
}

module.exports = new InventoryMovementRepository();
