'use strict';

const BaseRepository = require('../../common/BaseRepository');
const StockLevel = require('./stock_level.model');

/**
 * Repositorio de existencias — tenant: companyId obligatorio (guardia Base).
 *
 * Operaciones atómicas (ver ADR-008):
 *  - increment:          upsert + $inc (entradas / compensaciones).
 *  - decrementConditional: findOneAndUpdate con quantity { $gte } — sólo
 *    descuenta si queda >= 0; si no, devuelve null y el servicio responde 409.
 *  - setExact:           ajuste a recuento con condición de valor esperado
 *    (optimista): si el stock cambió entre lectura y escritura, devuelve null.
 */
class StockLevelRepository extends BaseRepository {
  constructor() {
    super(StockLevel, { requireTenant: true });
  }

  async getOne(companyId, warehouseId, productId) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, warehouseId, productId }).lean();
  }

  /** Suma delta (positivo o negativo); crea la fila si no existe (upsert). */
  async increment({ companyId, warehouseId, productId }, delta) {
    this._guard({ companyId });
    return this.model
      .findOneAndUpdate(
        { companyId, warehouseId, productId },
        { $inc: { quantity: delta } },
        { upsert: true, new: true }
      )
      .lean();
  }

  /** Resta sólo si el resultado no queda negativo. null => stock insuficiente. */
  async decrementConditional({ companyId, warehouseId, productId }, quantity) {
    this._guard({ companyId });
    return this.model
      .findOneAndUpdate(
        { companyId, warehouseId, productId, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true }
      )
      .lean();
  }

  /** Fija quantity sólo si coincide con el valor esperado. null => carrera. */
  async setExact({ companyId, warehouseId, productId }, expectedQuantity, newQuantity) {
    this._guard({ companyId });
    return this.model
      .findOneAndUpdate(
        { companyId, warehouseId, productId, quantity: expectedQuantity },
        { $set: { quantity: newQuantity } },
        { new: true }
      )
      .lean();
  }

  /** Crea la fila si no existe; null si otra petición ganó la carrera (11000). */
  async createIfAbsent(data) {
    this._guard(data);
    try {
      return await this.model.create(data);
    } catch (err) {
      if (err && err.code === 11000) return null;
      throw err;
    }
  }

  /** ¿Existe fila con existencias > 0 para este producto? (guardia de borrado) */
  async hasStockForProduct(companyId, productId) {
    this._guard({ companyId });
    return this.model.exists({ companyId, productId, quantity: { $gt: 0 } });
  }

  /** ¿Existe fila con existencias > 0 en este almacén? (guardia de borrado) */
  async hasStockInWarehouse(companyId, warehouseId) {
    this._guard({ companyId });
    return this.model.exists({ companyId, warehouseId, quantity: { $gt: 0 } });
  }

  /** Nº de almacenes de la lista con existencias > 0 (guardia sucursal). */
  async countWithStock(companyId, warehouseIds) {
    this._guard({ companyId });
    if (!warehouseIds.length) return 0;
    return this.model.countDocuments({
      companyId,
      warehouseId: { $in: warehouseIds },
      quantity: { $gt: 0 },
    });
  }
}

module.exports = new StockLevelRepository();
