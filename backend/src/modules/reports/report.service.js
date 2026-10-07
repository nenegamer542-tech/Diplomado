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

  /** Exporta hoja de cálculo Excel (.xls) con diseño profesional, tarjeta de KPIs, encabezado azul marino y resaltado en rojo para alertas. */
  async financeExportCsv(companyId, range) {
    const [{ incomes, expenses, purchases, sales }, accounts] = await Promise.all([
      reportsRepository.financeMovementsForExport(companyId, range),
      reportsRepository.accountsList(companyId),
    ]);
    const accountNames = new Map(accounts.map((a) => [String(a._id), `${a.code} - ${a.name}`]));

    const totalIncome = incomes.reduce((s, m) => s + (m.amount || 0), 0);
    const totalExpense = expenses.reduce((s, m) => s + (m.amount || 0), 0);
    const netBalance = totalIncome - totalExpense;
    const totalOperations = incomes.length + expenses.length + purchases.length + sales.length;

    const fmtMoney = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Reporte ERP</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; }
          .banner { background-color: #0f172a; color: #ffffff; text-align: center; font-size: 20px; font-weight: bold; padding: 14px; }
          .subbanner { background-color: #1e293b; color: #38bdf8; text-align: center; font-size: 13px; font-weight: bold; padding: 6px; }
          .kpi-table { margin-top: 12px; margin-bottom: 16px; border-collapse: collapse; }
          .kpi-label { background-color: #1e293b; color: #ffffff; font-weight: bold; padding: 8px 14px; border: 1px solid #334155; font-size: 12px; }
          .kpi-value { background-color: #ffffff; color: #0f172a; font-weight: bold; padding: 8px 14px; border: 1px solid #cbd5e1; font-size: 14px; text-align: right; }
          .data-table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          .th { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 12px; padding: 10px; border: 1px solid #334155; text-align: left; }
          .td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 12px; color: #1e293b; }
          .td-num { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #0f172a; text-align: right; }
          .tr-ingreso { background-color: #f0fdf4; }
          .tr-gasto { background-color: #fef2f2; color: #991b1b; }
          .tr-compra { background-color: #f0f9ff; }
          .tr-estimacion { background-color: #fefce8; }
          .badge-ingreso { background-color: #166534; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
          .badge-gasto { background-color: #991b1b; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="9" class="banner">EMPRESA CONSTRUCTORA TEC[ODE S.A. DE C.V.</td>
          </tr>
          <tr>
            <td colspan="9" class="subbanner">REPORTE OFICIAL DE MOVIMIENTOS Y OPERACIONES DE OBRA · EMISION: ${new Date().toLocaleDateString('es-MX')}</td>
          </tr>
        </table>

        <table class="kpi-table">
          <tr>
            <td class="kpi-label">TOTAL OPERACIONES</td>
            <td class="kpi-value">${totalOperations}</td>
          </tr>
          <tr>
            <td class="kpi-label">TOTAL INGRESOS</td>
            <td class="kpi-value" style="color:#16a34a">${fmtMoney(totalIncome)}</td>
          </tr>
          <tr>
            <td class="kpi-label">TOTAL GASTOS</td>
            <td class="kpi-value" style="color:#dc2626">${fmtMoney(totalExpense)}</td>
          </tr>
          <tr>
            <td class="kpi-label">SALDO NETO DISPONIBLE</td>
            <td class="kpi-value" style="color:#0284c7">${fmtMoney(netBalance)}</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th class="th">TIPO OPERACION</th>
              <th class="th">CODIGO / FOLIO</th>
              <th class="th">FECHA</th>
              <th class="th">CATEGORIA / CONCEPTO</th>
              <th class="th">METODO / ESTADO</th>
              <th class="th">CUENTA O FONDO</th>
              <th class="th" style="text-align:right">IMPORTE ($ MXN)</th>
              <th class="th">ESTADO</th>
              <th class="th">DESCRIPCION / JUSTIFICACION</th>
            </tr>
          </thead>
          <tbody>
            ${incomes.map(m => `
              <tr class="tr-ingreso">
                <td class="td"><span class="badge-ingreso">INGRESO</span></td>
                <td class="td"><b>${m.code || '—'}</b></td>
                <td class="td">${m.date ? new Date(m.date).toISOString().slice(0, 10) : '—'}</td>
                <td class="td">${m.category || 'ESTIMACIONES'}</td>
                <td class="td">${(m.method || 'TRANSFERENCIA').toUpperCase()}</td>
                <td class="td">${accountNames.get(String(m.accountId)) || 'TESORERIA'}</td>
                <td class="td-num" style="color:#16a34a">${fmtMoney(m.amount)}</td>
                <td class="td"><b>${m.status}</b></td>
                <td class="td">${m.description || 'Ingreso registrado en obra'}</td>
              </tr>
            `).join('')}

            ${expenses.map(m => `
              <tr class="tr-gasto">
                <td class="td"><span class="badge-gasto">GASTO</span></td>
                <td class="td"><b>${m.code || '—'}</b></td>
                <td class="td">${m.date ? new Date(m.date).toISOString().slice(0, 10) : '—'}</td>
                <td class="td">${m.category || 'MATERIALES'}</td>
                <td class="td">${(m.method || 'EFECTIVO').toUpperCase()}</td>
                <td class="td">${accountNames.get(String(m.accountId)) || 'CAJA CHICA'}</td>
                <td class="td-num" style="color:#dc2626">${fmtMoney(m.amount)}</td>
                <td class="td"><b>${m.status}</b></td>
                <td class="td">${m.description || 'Gasto operativo de obra'}</td>
              </tr>
            `).join('')}

            ${purchases.map(m => `
              <tr class="tr-compra">
                <td class="td">COMPRA OBRA</td>
                <td class="td"><b>${m.code || '—'}</b></td>
                <td class="td">${m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : '—'}</td>
                <td class="td">INSUMOS / MATERIALES</td>
                <td class="td">${m.status}</td>
                <td class="td">BODEGA GENERAL</td>
                <td class="td-num">${fmtMoney(m.total)}</td>
                <td class="td"><b>${m.status}</b></td>
                <td class="td">${m.notes || 'Orden de compra para obra'}</td>
              </tr>
            `).join('')}

            ${sales.map(m => `
              <tr class="tr-estimacion">
                <td class="td">ESTIMACION OBRA</td>
                <td class="td"><b>${m.code || '—'}</b></td>
                <td class="td">${m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : '—'}</td>
                <td class="td">AVANCE DE OBRA</td>
                <td class="td">${m.status}</td>
                <td class="td">TESORERIA GENERAL</td>
                <td class="td-num">${fmtMoney(m.total)}</td>
                <td class="td"><b>${m.status}</b></td>
                <td class="td">${m.notes || 'Estimacion contractual de obra'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const filename = `reporte-ejecutivo-tec-ode-${new Date().toISOString().slice(0, 10)}.xls`;
    return { filename, csv: `\uFEFF${excelHtml}` };
  },
};

module.exports = reportService;
