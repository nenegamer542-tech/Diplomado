'use strict';

const reportsRepository = require('./report.repository');

/**
 * Servicio de REPORTES (FASE 5) — sólo lectura, multiempresa estricto.
 *
 * Todos los datos salen de agregaciones acotadas por companyId. Los rangos
 * son opcionales: sin `from`/`to` el reporte es "histórico completo".
 */
const round2 = (n) => Math.round(n * 100) / 100;

/** Rango de fechas de un (year[, month]) en UTC para filtrar por `date`. */
function rangeFromYearMonth(year, month) {
  if (!year) return {};
  const from = new Date(Date.UTC(year, (month || 1) - 1, 1));
  const to = month
    ? new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) // último día del mes
    : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { from, to };
}

/** Escapa un valor para CSV (RFC 4180: entrecomillar y duplicar comillas). */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const reportService = {
  /** KPI globales: ventas/compras aprobadas, finanzas y conteos de catálogo. */
  async kpis(companyId, range) {
    const [salesByStatus, purchaseByStatus, income, expense, counts] = await Promise.all([
      reportsRepository.salesOrdersSummary(companyId, range),
      reportsRepository.purchaseOrdersSummary(companyId, range),
      reportsRepository.incomeTotal(companyId, range),
      reportsRepository.expenseTotal(companyId, range),
      reportsRepository.counts(companyId),
    ]);
    const approved = (rows) => {
      const row = rows.find((r) => r.status === 'APPROVED');
      return row ? { count: row.count, total: row.total } : { count: 0, total: 0 };
    };

    return {
      period: { from: range.from || null, to: range.to || null },
      sales: approved(salesByStatus),
      purchases: approved(purchaseByStatus),
      salesByStatus,
      purchaseByStatus,
      income,
      expense,
      net: round2(income.total - expense.total),
      catalog: counts,
    };
  },

  /** Ventas: totales por estado y serie mensual de aprobadas. */
  async salesReport(companyId, range) {
    const [byStatus, byMonth] = await Promise.all([
      reportsRepository.salesOrdersSummary(companyId, range),
      reportsRepository.salesOrdersByMonth(companyId, range),
    ]);
    return { period: { from: range.from || null, to: range.to || null }, byStatus, byMonth };
  },

  /** Compras: totales por estado y serie mensual de aprobadas. */
  async purchasesReport(companyId, range) {
    const [byStatus, byMonth] = await Promise.all([
      reportsRepository.purchaseOrdersSummary(companyId, range),
      reportsRepository.purchaseOrdersByMonth(companyId, range),
    ]);
    return { period: { from: range.from || null, to: range.to || null }, byStatus, byMonth };
  },

  /** Inventario valorizado a costo (existencia total por producto). */
  async inventoryReport(companyId) {
    const valuation = await reportsRepository.inventoryValuation(companyId);
    const counts = await reportsRepository.counts(companyId);
    return { ...valuation, lowStock: counts.lowStock };
  },

  /** Finanzas: ingresos/gastos/neto y desglose por categoría. */
  async financeReport(companyId, { year, month, from, to }) {
    const range = from || to ? { from, to } : rangeFromYearMonth(year, month);
    const [income, expense, incomeByCategory, expenseByCategory, accounts] = await Promise.all([
      reportsRepository.incomeTotal(companyId, range),
      reportsRepository.expenseTotal(companyId, range),
      reportsRepository.incomeByCategory(companyId, range),
      reportsRepository.expenseByCategory(companyId, range),
      reportsRepository.accountsList(companyId),
    ]);
    return {
      period: { from: range.from || null, to: range.to || null },
      income,
      expense,
      net: round2(income.total - expense.total),
      incomeByCategory,
      expenseByCategory,
      cash: {
        accountsBalance: round2(accounts.reduce((sum, a) => sum + a.balance, 0)),
        accounts: accounts.map((a) => ({
          _id: a._id,
          code: a.code,
          name: a.name,
          currency: a.currency,
          balance: a.balance,
          status: a.status,
        })),
      },
    };
  },

  /**
   * Presupuesto vs ejecutado: lo planeado (budgets) contra los gastos reales
   * del periodo; incluye categorías con gasto pero sin presupuesto.
   *  - Con `month`: fila por presupuesto mensual, ejecutado de ese mes.
   *  - Sin `month` (vista anual): planeado agregado por categoría en el año.
   */
  async budgetsReport(companyId, { year, month }) {
    const range = rangeFromYearMonth(year, month);
    const [budgets, actualByCategory] = await Promise.all([
      reportsRepository.budgetsFor(companyId, year, month),
      reportsRepository.expenseTotalsByCategory(companyId, range.from, range.to),
    ]);

    let items;
    if (month) {
      items = budgets.map((b) => {
        const actual = round2(actualByCategory.get(b.category) || 0);
        actualByCategory.delete(b.category);
        return {
          _id: b._id,
          year: b.year,
          month: b.month,
          category: b.category,
          planned: b.plannedAmount,
          actual,
          variance: round2(b.plannedAmount - actual),
          utilization: b.plannedAmount > 0 ? round2((actual / b.plannedAmount) * 100) : null,
        };
      });
    } else {
      const plannedByCategory = new Map();
      for (const b of budgets) {
        plannedByCategory.set(
          b.category,
          round2((plannedByCategory.get(b.category) || 0) + b.plannedAmount)
        );
      }
      items = [];
      for (const [category, planned] of plannedByCategory) {
        const actual = round2(actualByCategory.get(category) || 0);
        actualByCategory.delete(category);
        items.push({
          _id: null,
          year,
          month: null,
          category,
          planned,
          actual,
          variance: round2(planned - actual),
          utilization: planned > 0 ? round2((actual / planned) * 100) : null,
        });
      }
    }

    // Categorías con gasto real sin presupuesto planeado en el periodo.
    for (const [category, actual] of actualByCategory) {
      items.push({
        _id: null,
        year,
        month: month || null,
        category,
        planned: 0,
        actual: round2(actual),
        variance: round2(-actual),
        utilization: null,
      });
    }

    const planned = round2(items.reduce((sum, i) => sum + i.planned, 0));
    const executed = round2(items.reduce((sum, i) => sum + i.actual, 0));
    return { year, month: month || null, items, totals: { planned, executed, variance: round2(planned - executed) } };
  },

  /** Exporta ingresos+gastos del periodo como CSV (RFC 4180, con BOM UTF-8). */
  async financeExportCsv(companyId, range) {
    const [{ incomes, expenses }, accounts] = await Promise.all([
      reportsRepository.financeMovementsForExport(companyId, range),
      reportsRepository.accountsList(companyId),
    ]);
    const accountCode = new Map(accounts.map((a) => [String(a._id), a.code]));

    const header = ['tipo', 'codigo', 'fecha', 'categoria', 'metodo', 'cuenta', 'importe', 'estado', 'descripcion'];
    const toRow = (type, m) => [
      type,
      m.code,
      m.date instanceof Date ? m.date.toISOString() : new Date(m.date).toISOString(),
      m.category,
      m.method,
      accountCode.get(String(m.accountId)) || '',
      m.amount,
      m.status,
      m.description || '',
    ];

    const rows = [
      header,
      ...incomes.map((m) => toRow('INGRESO', m)),
      ...expenses.map((m) => toRow('GASTO', m)),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const filename = `movimientos-financieros-${new Date().toISOString().slice(0, 10)}.csv`;
    return { filename, csv: `\uFEFF${csv}` }; // BOM para Excel (UTF-8)
  },
};

module.exports = reportService;
