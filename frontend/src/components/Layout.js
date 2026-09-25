import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  getResponsiveLayout,
} from '../design-system/tokens';
import { TTAvatar, TTBreadcrumb, TTSearch } from '../design-system/components';
import { useNav } from '../nav/RouterContext';
import { TecodeLogo } from './TecodeLogo';

/**
 * Categorías de Menú TECTODE ERP
 */
export const MENU_CATEGORIES = [
  {
    category: 'INICIO',
    items: [
      { route: 'home', label: 'Dashboard', icon: '⚡', permission: null },
    ],
  },
  {
    category: 'OPERACIONES',
    items: [
      { route: 'products', label: 'Productos', icon: '📦', permission: 'products.read' },
      { route: 'warehouses', label: 'Almacenes', icon: '🏬', permission: 'warehouses.read' },
      { route: 'stock', label: 'Existencias', icon: '📊', permission: 'inventory.read' },
      { route: 'movements', label: 'Movimientos', icon: '🔄', permission: 'inventory.read' },
      { route: 'counts', label: 'Inventarios Físicos', icon: '📋', permission: 'inventory.read' },
      { route: 'suppliers', label: 'Proveedores', icon: '🏢', permission: 'suppliers.read' },
      { route: 'purchaseOrders', label: 'Órdenes de Compra', icon: '🛒', permission: 'purchases.read' },
      { route: 'customers', label: 'Clientes', icon: '👥', permission: 'customers.read' },
      { route: 'salesOrders', label: 'Pedidos de Venta', icon: '🏷️', permission: 'sales.orders.read' },
    ],
  },
  {
    category: 'FINANZAS',
    items: [
      { route: 'accounts', label: 'Cuentas', icon: '💳', permission: 'finance.accounts.read' },
      { route: 'incomes', label: 'Ingresos', icon: '📈', permission: 'finance.income.read' },
      { route: 'expenses', label: 'Gastos', icon: '📉', permission: 'finance.expenses.read' },
      { route: 'budgets', label: 'Presupuestos', icon: '💰', permission: 'finance.budgets.read' },
      { route: 'reports', label: 'Reportes', icon: '📄', permission: 'reports.read' },
    ],
  },
  {
    category: 'NEGOCIO',
    items: [
      { route: 'leads', label: 'CRM / Leads', icon: '🎯', permission: 'crm.read' },
      { route: 'employees', label: 'RRHH / Empleados', icon: '👔', permission: 'hr.read' },
      { route: 'boms', label: 'Listas BOM', icon: '⚙️', permission: 'production.read' },
      { route: 'productionOrders', label: 'Órdenes Producción', icon: '🏭', permission: 'production.read' },
    ],
  },
  {
    category: 'ADMINISTRACIÓN',
    items: [
      { route: 'branches', label: 'Sucursales', icon: '📍', permission: 'branches.read' },
      { route: 'users', label: 'Usuarios', icon: '👤', permission: 'users.read' },
      { route: 'roles', label: 'Roles y Permisos', icon: '🛡️', permission: 'roles.read' },
      { route: 'audit', label: 'Auditoría', icon: '👁️', permission: 'audit.read' },
    ],
  },
];

// Compatibilidad hacia atrás para HomeScreen u otros módulos
export const MENU = MENU_CATEGORIES.map((cat) => ({
  section: cat.category,
  items: cat.items,
}));

export default function Layout({ children }) {
  const { session, logout, can } = useAuth();
  const { route, go, back, canGoBack } = useNav();
  const { width } = useWindowDimensions();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const { isMobile, isTablet } = getResponsiveLayout(width);
  const { company, user, role, branch } = session || {};

  // Forzar colapso en Tablet
  const isSidebarCollapsed = isTablet || collapsed;

  // Filtrado RBAC estricto
  const filteredCategories = MENU_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((cat) => cat.items.length > 0);

  // Mapeo para Breadcrumb
  const currentItem = MENU_CATEGORIES.flatMap((c) => c.items).find((i) => i.route === route.name);
  const currentCategory = MENU_CATEGORIES.find((c) => c.items.some((i) => i.route === route.name));

  const breadcrumbs = [
    { label: 'Tec[ode', onPress: () => go('home') },
    ...(currentCategory ? [{ label: currentCategory.category }] : []),
    ...(currentItem ? [{ label: currentItem.label }] : []),
  ];

  const handleNavigate = (routeName) => {
    go(routeName);
    if (mobileDrawerOpen) setMobileDrawerOpen(false);
  };

  const renderNavSection = (cat) => (
    <View key={cat.category} style={styles.navCategory}>
      {!isSidebarCollapsed ? <Text style={styles.navCategoryTitle}>{cat.category}</Text> : null}
      {cat.items.map((item) => {
        const isActive = route.name === item.route;
        return (
          <Pressable
            key={item.route}
            onPress={() => handleNavigate(item.route)}
            style={({ hovered }) => [
              styles.navItem,
              isSidebarCollapsed && styles.navItemCollapsed,
              isActive && styles.navItemActive,
              hovered && !isActive && styles.navItemHovered,
            ]}
          >
            <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{item.icon}</Text>
            {!isSidebarCollapsed ? (
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.shell}>
      {/* HEADER SUPERIOR */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isMobile ? (
            <Pressable style={styles.iconBtn} onPress={() => setMobileDrawerOpen(true)}>
              <Text style={styles.iconBtnText}>☰</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.iconBtn} onPress={() => setCollapsed((c) => !c)}>
              <Text style={styles.iconBtnText}>{isSidebarCollapsed ? '≫' : '≪'}</Text>
            </Pressable>
          )}

          {canGoBack && route.name !== 'home' ? (
            <Pressable style={styles.backBtn} onPress={back}>
              <Text style={styles.backBtnText}>‹ Volver</Text>
            </Pressable>
          ) : null}

          <TTBreadcrumb items={breadcrumbs} />
        </View>

        <View style={styles.headerRight}>
          {!isMobile ? (
            <TTSearch
              value={globalSearch}
              onChangeText={setGlobalSearch}
              placeholder="Buscar en Tec[ode ERP…"
              style={styles.globalSearch}
            />
          ) : null}

          <Pressable style={styles.badgeBox}>
            <Text style={styles.badgeCompany}>{company?.name || 'Tec[ode'}</Text>
            {branch ? <Text style={styles.badgeBranch}> · {branch.name}</Text> : null}
          </Pressable>

          <Pressable style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔔</Text>
          </Pressable>

          <Pressable style={styles.userMenuTrigger} onPress={() => setUserMenuOpen((u) => !u)}>
            <TTAvatar name={user?.name || 'Usuario'} size="sm" color={COLORS.accent} />
            {!isMobile ? (
              <View style={styles.userMeta}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name} {user?.lastName || ''}
                </Text>
                <Text style={styles.userRole} numberOfLines={1}>
                  {role?.label || role?.code || 'Usuario'}
                </Text>
              </View>
            ) : null}
            <Text style={styles.caret}>▾</Text>
          </Pressable>
        </View>
      </View>

      {/* MENÚ FLOTANTE DE USUARIO */}
      {userMenuOpen ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setUserMenuOpen(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setUserMenuOpen(false)}>
            <View style={styles.userDropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>{user?.name} {user?.lastName || ''}</Text>
                <Text style={styles.dropdownSub}>{user?.email}</Text>
                <Text style={styles.dropdownRole}>Rol: {role?.label || role?.code || 'Sin Rol'}</Text>
              </View>

              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setUserMenuOpen(false);
                  go('home');
                }}
              >
                <Text style={styles.dropdownItemText}>⚡ Dashboard</Text>
              </Pressable>

              {can('users.read') ? (
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setUserMenuOpen(false);
                    go('users');
                  }}
                >
                  <Text style={styles.dropdownItemText}>⚙️ Configuración</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={[styles.dropdownItem, styles.dropdownLogout]}
                onPress={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
              >
                <Text style={styles.logoutText}>🚪 Cerrar Sesión</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      {/* CUERPO PRINCIPAL (SIDEBAR + CONTENIDO) */}
      <View style={styles.body}>
        {/* SIDEBAR DESKTOP / TABLET */}
        {!isMobile ? (
          <View style={[styles.sidebar, isSidebarCollapsed && styles.sidebarCollapsed]}>
            <View style={styles.brandHeader}>
              <TecodeLogo size="md" showTag={!isSidebarCollapsed} />
            </View>

            <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
              {filteredCategories.map(renderNavSection)}
            </ScrollView>
          </View>
        ) : null}

        {/* DRAWER MÓVIL */}
        {isMobile && mobileDrawerOpen ? (
          <Modal transparent visible animationType="slide" onRequestClose={() => setMobileDrawerOpen(false)}>
            <View style={styles.drawerBackdrop}>
              <Pressable style={styles.drawerOverlay} onPress={() => setMobileDrawerOpen(false)} />
              <View style={styles.mobileDrawer}>
                <View style={styles.drawerHeader}>
                  <View style={styles.brandHeader}>
                    <View style={styles.brandLogoBox}>
                      <Text style={styles.brandLogoText}>T</Text>
                    </View>
                    <View>
                      <Text style={styles.brandName}>Tec[ode</Text>
                      <Text style={styles.brandTag}>ERP Enterprise</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setMobileDrawerOpen(false)}>
                    <Text style={styles.closeDrawerText}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView style={styles.drawerBody}>
                  {filteredCategories.map(renderNavSection)}
                </ScrollView>
              </View>
            </View>
          </Modal>
        ) : null}

        {/* ÁREA DE CONTENIDO PRINCIPAL */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    height: 58,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  backBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  backBtnText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  globalSearch: {
    maxWidth: 260,
  },
  badgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
  },
  badgeCompany: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  badgeBranch: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  userMenuTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  userMeta: {
    gap: 1,
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    maxWidth: 120,
  },
  userRole: {
    color: COLORS.textMuted,
    fontSize: 10,
    maxWidth: 120,
  },
  caret: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginRight: 4,
  },

  // Dropdown Menu Usuario
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  userDropdown: {
    width: 240,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    gap: 2,
  },
  dropdownHeader: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 2,
  },
  dropdownTitle: {
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  dropdownSub: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  dropdownRole: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 4,
  },
  dropdownItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 2,
    borderRadius: RADIUS.sm,
  },
  dropdownItemText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  dropdownLogout: {
    backgroundColor: `${COLORS.error}15`,
    marginTop: SPACING.xs,
  },
  logoutText: {
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Layout Body
  body: {
    flex: 1,
    flexDirection: 'row',
  },

  // Sidebar
  sidebar: {
    width: 240,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: SPACING.md,
  },
  sidebarCollapsed: {
    width: 72,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  brandLogoBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    color: COLORS.textPrimary,
    fontWeight: '900',
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  brandTitleArea: {
    gap: 1,
  },
  brandName: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    letterSpacing: 0.5,
  },
  brandTag: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.5,
  },

  sidebarNav: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
  },
  navCategory: {
    marginBottom: SPACING.md,
    gap: 2,
  },
  navCategoryTitle: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: `${COLORS.accent}15`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}40`,
  },
  navItemHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  navIcon: {
    fontSize: 16,
  },
  navIconActive: {
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  navLabelActive: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  // Content Area
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentInner: {
    padding: SPACING.xl,
    gap: SPACING.xl,
  },

  // Mobile Drawer
  drawerBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.backdrop,
  },
  drawerOverlay: {
    flex: 1,
  },
  mobileDrawer: {
    width: 280,
    backgroundColor: COLORS.surface,
    height: '100%',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
  },
  closeDrawerText: {
    color: COLORS.textMuted,
    fontSize: 20,
    padding: SPACING.xs,
  },
  drawerBody: {
    flex: 1,
  },
});
