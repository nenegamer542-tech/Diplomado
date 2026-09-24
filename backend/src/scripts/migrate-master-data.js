'use strict';

/**
 * Backfill idempotente de catálogos FASE 2 para tenants ya existentes.
 * No borra datos: crea/recupera catálogos y enlaza snapshots legados.
 * Ejecutar con npm run migrate:master-data tras respaldar la BD.
 */
const { connectDatabase, disconnectDatabase } = require('../config/database');
const Product = require('../modules/products/product.model');
const Company = require('../modules/companies/company.model');
const Account = require('../modules/accounts/account.model');
const MasterData = require('../modules/master-data/master_data.model');
const Role = require('../modules/roles/role.model');
const { DEFAULT_ROLES } = require('../config/permissions');

const safeCode = (value) => String(value).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 20) || 'DEFAULT';

async function upsertMaster(companyId, type, source) {
  const code = safeCode(source.code || source.name);
  return MasterData.findOneAndUpdate(
    { companyId, type, code },
    { $setOnInsert: { companyId, type, code, name: String(source.name || code).slice(0, 100), ...source.fields, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  await connectDatabase();
  let currencies = 0;
  let productRefs = 0;
  let roles = 0;
  try {
    for await (const company of Company.find({}).lean().cursor()) {
      const currencyCode = safeCode(company.currency || 'MXN').slice(0, 3);
      const currency = await upsertMaster(company._id, 'currency', {
        code: currencyCode,
        name: currencyCode,
        fields: { symbol: currencyCode, decimalPlaces: 2 },
      });
      currencies++;
      await Company.updateOne({ _id: company._id, currencyId: { $exists: false } }, { $set: { currencyId: currency._id } });

      const tenantRoles = await Role.find({ companyId: company._id, isSystem: true });
      for (const role of tenantRoles) {
        const defaults = DEFAULT_ROLES[role.code];
        if (!defaults) continue;
        const merged = [...new Set([...role.permissions, ...defaults.permissions])];
        if (merged.length !== role.permissions.length) {
          role.permissions = merged;
          await role.save();
          roles++;
        }
      }

      for await (const product of Product.find({ companyId: company._id }).lean().cursor()) {
        const patch = {};
        if (product.category && !product.categoryId) {
          const item = await upsertMaster(company._id, 'category', { name: product.category, code: product.category });
          patch.categoryId = item._id;
        }
        if (product.unit && !product.unitId) {
          const item = await upsertMaster(company._id, 'unit', {
            name: product.unit,
            code: product.unit,
            fields: { symbol: product.unit, decimalPlaces: 3, allowFractions: true },
          });
          patch.unitId = item._id;
        }
        if (Number.isFinite(product.taxRate) && !product.taxId) {
          const rate = product.taxRate;
          const item = await upsertMaster(company._id, 'tax', {
            name: `Impuesto ${rate}%`,
            code: `TAX_${rate}`,
            fields: { rate },
          });
          patch.taxId = item._id;
        }
        if (product.brand && !product.brandId) {
          const item = await upsertMaster(company._id, 'brand', { name: product.brand, code: product.brand });
          patch.brandId = item._id;
        }
        if (Object.keys(patch).length) {
          await Product.updateOne({ _id: product._id, companyId: company._id }, { $set: patch });
          productRefs++;
        }
      }

      for await (const account of Account.find({ companyId: company._id, currencyId: { $exists: false } }).lean().cursor()) {
        const code = safeCode(account.currency || currencyCode).slice(0, 3);
        const accountCurrency = code === currencyCode ? currency : await upsertMaster(company._id, 'currency', {
          code, name: code, fields: { symbol: code, decimalPlaces: 2 },
        });
        await Account.updateOne({ _id: account._id, companyId: company._id }, { $set: { currencyId: accountCurrency._id } });
      }
    }
    console.log(`[migration] FASE 2 lista: ${currencies} monedas base, ${productRefs} productos enlazados, ${roles} roles actualizados.`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('[migration] Error:', err.message);
  process.exitCode = 1;
});
