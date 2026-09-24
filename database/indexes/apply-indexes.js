'use strict';

/**
 * Aplica/verifica los índices declarados en los modelos (idempotente).
 *
 * Uso (desde backend/):  npm run indexes
 *
 * syncIndexes() crea los índices que falten y elimina los obsoletos que
 * Mongo tenga de versiones anteriores del esquema. Ejecutar tras cambios
 * de modelo y en cada despliegue.
 */

const { connectDatabase, disconnectDatabase } = require('../../backend/src/config/database');
const Company = require('../../backend/src/modules/companies/company.model');
const Branch = require('../../backend/src/modules/branches/branch.model');
const Role = require('../../backend/src/modules/roles/role.model');
const User = require('../../backend/src/modules/users/user.model');
const AuditLog = require('../../backend/src/modules/audit/audit.model');
const Product = require('../../backend/src/modules/products/product.model');
const MasterData = require('../../backend/src/modules/master-data/master_data.model');
const Warehouse = require('../../backend/src/modules/warehouses/warehouse.model');
const StockLevel = require('../../backend/src/modules/inventory/stock_level.model');
const InventoryMovement = require('../../backend/src/modules/inventory/inventory_movement.model');
const Supplier = require('../../backend/src/modules/suppliers/supplier.model');
const Customer = require('../../backend/src/modules/customers/customer.model');
const PurchaseOrder = require('../../backend/src/modules/purchase-orders/purchase_order.model');
const SalesOrder = require('../../backend/src/modules/sales-orders/sales_order.model');
const FinanceAccount = require('../../backend/src/modules/accounts/account.model');
const Income = require('../../backend/src/modules/incomes/income.model');
const Expense = require('../../backend/src/modules/expenses/expense.model');
const Budget = require('../../backend/src/modules/budgets/budget.model');
const Lead = require('../../backend/src/modules/crm/lead.model');
const Employee = require('../../backend/src/modules/hr/employee.model');
const Bom = require('../../backend/src/modules/production/bom.model');
const ProductionOrder = require('../../backend/src/modules/production/production_order.model');
const { Counter } = require('../../backend/src/common/sequence');

const MODELS = [
  Company,
  Branch,
  Role,
  User,
  AuditLog,
  Product,
  MasterData,
  Warehouse,
  StockLevel,
  InventoryMovement,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesOrder,
  FinanceAccount,
  Income,
  Expense,
  Budget,
  Lead,
  Employee,
  Bom,
  ProductionOrder,
  Counter,
];

async function main() {
  await connectDatabase();
  for (const model of MODELS) {
    const removed = await model.syncIndexes();
    const indexes = model.schema.indexes().map(([keys, opts]) => opts.name || JSON.stringify(keys));
    console.log(`[indexes] ${model.modelName}: sincronizados (${indexes.length}) | eliminados: ${JSON.stringify(removed)}`);
  }
  console.log('[indexes] Índices sincronizados correctamente.');
}

main()
  .catch((err) => {
    console.error('[indexes] Error:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {});
  });
