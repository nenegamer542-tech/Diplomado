'use strict';

const mongoose = require('mongoose');

/**
 * INVENTORY MOVEMENT — Historial INMUTABLE de movimientos de stock.
 * Colección: inventory_movements (siempre companyId-scoped)
 *
 * Tipos: ENTRY (entrada), EXIT (salida), ADJUSTMENT (ajuste a recuento),
 * TRANSFER (transferencia entre almacenes).
 *
 * Sólo el servicio de inventario lo crea; no existe PATCH/DELETE de la API
 * (la auditoría y el histórico del stock no se reescriben). Cada fila guarda
 * quantityBefore/quantityAfter del almacén de referencia (warehouseId) para
 * reconstruir el saldo sin confiar en agregados.
 */
const inventoryMovementSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    type: { type: String, enum: ['ENTRY', 'EXIT', 'ADJUSTMENT', 'TRANSFER'], required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Almacén de referencia: origen en salidas y transferencias.
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    // Destino, sólo en transferencias.
    toWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    // Cantidad pedida por el usuario (siempre > 0).
    quantity: { type: Number, required: true, min: [0, 'La cantidad no puede ser negativa.'] },
    // Cambio aplicado en warehouseId (+ entrada / - salida / delta ajuste / - transferencia).
    delta: { type: Number, required: true },
    // Saldo del almacén de referencia antes/después del movimiento.
    quantityBefore: { type: Number, required: true, min: 0 },
    quantityAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 240, default: null },
    reference: { type: String, trim: true, maxlength: 60, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, strict: true }
);

inventoryMovementSchema.index({ companyId: 1, createdAt: -1 });
inventoryMovementSchema.index({ companyId: 1, productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ companyId: 1, warehouseId: 1, createdAt: -1 });
inventoryMovementSchema.index({ companyId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
