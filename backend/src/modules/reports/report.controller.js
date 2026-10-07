'use strict';

const { ok } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const reportService = require('./report.service');

/** Rango {from,to} ya validado/coercido por zod (query). */
const range = (req) => ({ from: req.query.from, to: req.query.to });

const kpis = asyncHandler(async (req, res) => {
  const data = await reportService.kpis(req.user.companyId, range(req));
  return ok(res, data);
});

const sales = asyncHandler(async (req, res) => {
  const data = await reportService.salesReport(req.user.companyId, range(req));
  return ok(res, data);
});

const purchases = asyncHandler(async (req, res) => {
  const data = await reportService.purchasesReport(req.user.companyId, range(req));
  return ok(res, data);
});

const inventory = asyncHandler(async (req, res) => {
  const data = await reportService.inventoryReport(req.user.companyId);
  return ok(res, data);
});

const finance = asyncHandler(async (req, res) => {
  const data = await reportService.financeReport(req.user.companyId, {
    year: req.query.year,
    month: req.query.month,
    from: req.query.from,
    to: req.query.to,
  });
  return ok(res, data);
});

const budgets = asyncHandler(async (req, res) => {
  const data = await reportService.budgetsReport(req.user.companyId, {
    year: req.query.year,
    month: req.query.month,
  });
  return ok(res, data);
});

const exportCsv = asyncHandler(async (req, res) => {
  const { filename, csv } = await reportService.financeExportCsv(req.user.companyId, range(req));
  const xlsFilename = filename.endsWith('.xls') ? filename : filename.replace(/\.csv$/, '.xls');
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${xlsFilename}"`);
  return res.send(csv);
});

module.exports = { kpis, sales, purchases, inventory, finance, budgets, exportCsv };
