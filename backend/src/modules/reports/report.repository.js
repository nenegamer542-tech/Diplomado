'use strict';

const mongoose = require('mongoose');
const PurchaseOrder = require('../purchase-orders/purchase_order.model');
const SalesOrder = require('../sales-orders/sales_order.model');
const Income = require('../incomes/income.model');
const Expense = require('../expenses/expense.model');
const Budget = require('../budgets/budget.model');
const StockLevel = require('../inventory/stock_level.model');
const Product = require('../products/product.model');
const Supplier = require('../suppliers/supplier.model');
const Customer = require('../customers/customer.model');
const FinanceAccount = require('../accounts/account.model');

/**
 * Repositorio de REPORTES (FASE 5) — único punto de acceso a agregaciones.
 * Todas las pipelines llevan `companyId` en $match: multiempresa estricto.
 */
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Construye el filtro de fechas [{ $gte }, { $lte }] sobre `field`. */
function dateRange(field, from, to) {
  const match = {};
  if (from) match[field] = { ...match[field], $gte: from };
  if (to) match[field] = { ...match[field], $lte: to };
  return match;
}

const reportsRepository = {
  /** Conteos simples de catálogo. */
  async counts(companyId) {
    const guard = { companyId: oid(companyId) };
    const [products, customers, suppliers, lowStock] = await Promise.all([
      Product.countDocuments({ ...guard, status: 'active' }),
      Customer.countDocuments(guard),
      Supplier.countDocuments(guard),
      this.lowStockCount(companyId),
    ]);
    return { products, customers, suppliers, lowStock };
  },

  /** Productos activos con existencia <= minStock (>0). Pipeline con $lookup. */
  async lowStockCount(companyId) {
    const rows = await StockLevel.aggregate([
      { $match: { companyId: oid(companyId) } },
      {
        $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' },
      },
      { $unwind: '$product' },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: ['$product.minStock', 0] },
              { $lte: ['$quantity', '$product.minStock'] },
            ],
          },
        },
      },
      { $count: 'total' },
    ]);
    return rows.length ? rows[0].total : 0;
  },

  /** Totales de órdenes por estado en un rango de fechas. */
  async ordersSummary(Model, companyId, { from, to } = {}) {
    const match = { companyId: oid(companyId), ...dateRange('createdAt', from, to) };
    const rows = await Model.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } },
    ]);
    return rows.map((r) => ({ status: r._id, count: r.count, total: Math.round(r.total * 100) / 100 }));
  },

  /** Serie mensual de órdenes aprobadas (ventas o compras). */
  async ordersByMonth(Model, companyId, { from, to } = {}) {
    const match = {
      companyId: oid(companyId),
      status: 'APPROVED',
      ...dateRange('createdAt', from, to),
    };
    const rows = await Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          total: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({ month: r._id, count: r.count, total: Math.round(r.total * 100) / 100 }));
  },

  /** Suma/contador de ingresos o gastos (sólo POSTED) en un rango. */
  async movementsTotal(Model, companyId, { from, to, matchExtra = {} } = {}) {
    const match = {
      companyId: oid(companyId),
      status: 'POSTED',
      ...dateRange('date', from, to),
      ...matchExtra,
    };
    const rows = await Model.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);
    if (!rows.length) return { count: 0, total: 0 };
    return { count: rows[0].count, total: Math.round(rows[0].total * 100) / 100 };
  },

  /** Totales por categoría de ingresos o gastos (sólo POSTED) en un rango. */
  async movementsByCategory(Model, companyId, { from, to } = {}) {
    const match = {
      companyId: oid(companyId),
      status: 'POSTED',
      ...dateRange('date', from, to),
    };
    const rows = await Model.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);
    return rows.map((r) => ({
      category: r._id,
      count: r.count,
      total: Math.round(r.total * 100) / 100,
    }));
  },

  /** Suma de gastos por categoría en un rango (para ejecución vs presupuesto). */
  async expenseTotalsByCategory(companyId, from, to) {
    const rows = await this.movementsByCategory(Expense, companyId, { from, to });
    return new Map(rows.map((r) => [r.category, r.total]));
  },

  /** Existencia total valorizada a costo: por producto, en todas las bodegas. */
  async inventoryValuation(companyId) {
    const rows = await StockLevel.aggregate([
      { $match: { companyId: oid(companyId) } },
      { $group: { _id: '$productId', quantity: { $sum: '$quantity' } } },
      {
        $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          sku: '$product.sku',
          name: '$product.name',
          quantity: 1,
          costPrice: '$product.costPrice',
          value: { $multiply: ['$quantity', '$product.costPrice'] },
        },
      },
      { $sort: { value: -1 } },
    ]);
    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
    const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);
    return {
      items: rows.map((r) => ({
        ...r,
        value: Math.round(r.value * 100) / 100,
      })),
      totalQuantity,
      totalValue: Math.round(totalValue * 100) / 100,
    };
  },

  /** Presupuestos de (year[, month]) de la empresa. */
  async budgetsFor(companyId, year, month) {
    const filter = { companyId: oid(companyId), year };
    if (month) filter.month = month;
    return Budget.find(filter).sort({ month: 1, category: 1 }).lean();
  },

  /** Movimientos financieros para exportar CSV (rangos opcionales). */
  async financeMovementsForExport(companyId, { from, to } = {}) {
    const [incomes, expenses] = await Promise.all([
      Income.find({
        companyId: oid(companyId),
        ...dateRange('date', from, to),
      })
        .sort({ date: 1 })
        .lean(),
      Expense.find({
        companyId: oid(companyId),
        ...dateRange('date', from, to),
      })
        .sort({ date: 1 })
        .lean(),
    ]);
    return { incomes, expenses };
  },

  /** Cuentas de la empresa (código/nombre para el CSV y saldo agregado). */
  async accountsList(companyId) {
    return FinanceAccount.find({ companyId: oid(companyId) }).sort({ code: 1 }).lean();
  },
};

/** Envoltorios concretos: el service nunca recibe modelos (capa intacta). */
reportsRepository.salesOrdersSummary = (companyId, range) =>
  reportsRepository.ordersSummary(SalesOrder, companyId, range);
reportsRepository.purchaseOrdersSummary = (companyId, range) =>
  reportsRepository.ordersSummary(PurchaseOrder, companyId, range);
reportsRepository.salesOrdersByMonth = (companyId, range) =>
  reportsRepository.ordersByMonth(SalesOrder, companyId, range);
reportsRepository.purchaseOrdersByMonth = (companyId, range) =>
  reportsRepository.ordersByMonth(PurchaseOrder, companyId, range);
reportsRepository.incomeTotal = (companyId, range) =>
  reportsRepository.movementsTotal(Income, companyId, range);
reportsRepository.expenseTotal = (companyId, range) =>
  reportsRepository.movementsTotal(Expense, companyId, range);
reportsRepository.incomeByCategory = (companyId, range) =>
  reportsRepository.movementsByCategory(Income, companyId, range);
reportsRepository.expenseByCategory = (companyId, range) =>
  reportsRepository.movementsByCategory(Expense, companyId, range);

module.exports = reportsRepository;
