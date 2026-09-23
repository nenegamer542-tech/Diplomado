/**
 * Registro de rutas FASE 7: el nombre de ruta coincide con las entradas del
 * menú de `components/Layout.js` y con `RouterContext`.
 */
import HomeScreen from './HomeScreen';

// Inventario
import ProductsScreen from './inventory/ProductsScreen';
import WarehousesScreen from './inventory/WarehousesScreen';
import StockScreen from './inventory/StockScreen';
import MovementsScreen from './inventory/MovementsScreen';

// Compras / Ventas
import SuppliersScreen from './purchases/SuppliersScreen';
import PurchaseOrdersScreen from './purchases/PurchaseOrdersScreen';
import CustomersScreen from './sales/CustomersScreen';
import SalesOrdersScreen from './sales/SalesOrdersScreen';

// Finanzas / Reportes
import AccountsScreen from './finance/AccountsScreen';
import IncomesScreen from './finance/IncomesScreen';
import ExpensesScreen from './finance/ExpensesScreen';
import BudgetsScreen from './finance/BudgetsScreen';
import ReportsScreen from './finance/ReportsScreen';

// CRM / RRHH / Producción
import LeadsScreen from './crm/LeadsScreen';
import EmployeesScreen from './hr/EmployeesScreen';
import BomsScreen from './production/BomsScreen';
import ProductionOrdersScreen from './production/ProductionOrdersScreen';

// Configuración
import UsersScreen from './config/UsersScreen';
import RolesScreen from './config/RolesScreen';
import BranchesScreen from './config/BranchesScreen';
import AuditScreen from './config/AuditScreen';

export const SCREENS = {
  home: HomeScreen,
  products: ProductsScreen,
  warehouses: WarehousesScreen,
  stock: StockScreen,
  movements: MovementsScreen,
  suppliers: SuppliersScreen,
  purchaseOrders: PurchaseOrdersScreen,
  customers: CustomersScreen,
  salesOrders: SalesOrdersScreen,
  accounts: AccountsScreen,
  incomes: IncomesScreen,
  expenses: ExpensesScreen,
  budgets: BudgetsScreen,
  reports: ReportsScreen,
  leads: LeadsScreen,
  employees: EmployeesScreen,
  boms: BomsScreen,
  productionOrders: ProductionOrdersScreen,
  users: UsersScreen,
  roles: RolesScreen,
  branches: BranchesScreen,
  audit: AuditScreen,
};
