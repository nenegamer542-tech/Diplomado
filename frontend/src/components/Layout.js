import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../nav/RouterContext';

/**
 * Shell de la aplicación FASE 7: cabecera (empresa/rol/salida) + menú lateral
 * filtrado por permisos (RBAC del backend) + contenido. En pantallas angostas
 * el menú se convierte en tira horizontal de píldoras.
 */
/** Menú navegable (exportado: HomeScreen muestra los mismos accesos). */
export const MENU = [
  {
    section: 'Inventario',
    items: [
      { route: 'products', label: 'Productos', permission: 'products.read' },
      { route: 'warehouses', label: 'Almacenes', permission: 'warehouses.read' },
      { route: 'stock', label: 'Existencias', permission: 'inventory.read' },
      { route: 'movements', label: 'Movimientos', permission: 'inventory.read' },
    ],
  },
  {
    section: 'Compras',
    items: [
      { route: 'suppliers', label: 'Proveedores', permission: 'suppliers.read' },
      { route: 'purchaseOrders', label: 'Órdenes de compra', permission: 'purchases.read' },
    ],
  },
  {
    section: 'Ventas',
    items: [
      { route: 'customers', label: 'Clientes', permission: 'customers.read' },
      { route: 'salesOrders', label: 'Pedidos de venta', permission: 'sales.orders.read' },
    ],
  },
  {
    section: 'Finanzas',
    items: [
      { route: 'accounts', label: 'Cuentas', permission: 'finance.accounts.read' },
      { route: 'incomes', label: 'Ingresos', permission: 'finance.income.read' },
      { route: 'expenses', label: 'Gastos', permission: 'finance.expenses.read' },
      { route: 'budgets', label: 'Presupuestos', permission: 'finance.budgets.read' },
      { route: 'reports', label: 'Reportes', permission: 'reports.read' },
    ],
  },
  {
    section: 'CRM',
    items: [{ route: 'leads', label: 'Leads', permission: 'crm.read' }],
  },
  {
    section: 'RRHH',
    items: [{ route: 'employees', label: 'Empleados', permission: 'hr.read' }],
  },
  {
    section: 'Producción',
    items: [
      { route: 'boms', label: 'Listas de materiales', permission: 'production.read' },
      { route: 'productionOrders', label: 'Órdenes de trabajo', permission: 'production.read' },
    ],
  },
  {
    section: 'Configuración',
    items: [
      { route: 'users', label: 'Usuarios', permission: 'users.read' },
      { route: 'roles', label: 'Roles y permisos', permission: 'roles.read' },
      { route: 'branches', label: 'Sucursales', permission: 'branches.read' },
      { route: 'audit', label: 'Auditoría', permission: 'audit.read' },
    ],
  },
];

export default function Layout({ children }) {
  const { session, logout, can } = useAuth();
  const { route, go, back, canGoBack } = useNav();
  const { width } = useWindowDimensions();

  const { company, user, role, branch } = session || {};
  const wide = width >= 900;

  const sections = MENU.map((s) => ({
    ...s,
    items: s.items.filter((i) => can(i.permission)),
  })).filter((s) => s.items.length > 0);

  const renderNav = () =>
    sections.map((s) => (
      <View key={s.section} style={wide ? styles.navSection : styles.navSectionH}>
        {wide ? <Text style={styles.navTitle}>{s.section}</Text> : null}
        {s.items.map((item) => {
          const active = route.name === item.route;
          return (
            <Pressable
              key={item.route}
              style={[wide ? styles.navItem : styles.navPill, active && styles.navItemOn]}
              onPress={() => go(item.route)}
            >
              <Text style={[wide ? styles.navText : styles.navPillText, active && styles.navTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ));

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {canGoBack && route.name !== 'home' ? (
            <Pressable style={styles.back} onPress={back}>
              <Text style={styles.backText}>‹ Atrás</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => go('home')}>
            <Text style={styles.brand}>{company?.name || 'ERP Multiempresa'}</Text>
          </Pressable>
          <Text style={styles.headerMeta}>
            {user?.name} {user?.lastName || ''} · {role?.label || role?.code || 'Sin rol'}
            {branch ? ` · ${branch.name}` : ''}
          </Text>
        </View>
        <Pressable style={styles.logout} onPress={() => logout()}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={[styles.body, wide && stylesBodyWide(wide)]}>
        {wide ? (
          <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarInner}>
            {renderNav()}
          </ScrollView>
        ) : (
          <ScrollView horizontal style={styles.navStrip} contentContainerStyle={styles.navStripInner}>
            {renderNav()}
          </ScrollView>
        )}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// Sólo desktop coloca el menú a la izquierda (fila); en móvil va arriba.
function stylesBodyWide(wide) {
  return wide ? styles.bodyWide : undefined;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 },
  back: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  backText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  brand: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  headerMeta: { fontSize: 12, color: '#64748b' },
  logout: { backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#b91c1c', fontWeight: '600', fontSize: 13 },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  sidebar: { width: 232, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  sidebarInner: { paddingVertical: 12, gap: 14 },
  navStrip: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  navStripInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  navSection: { paddingHorizontal: 12, gap: 2 },
  navSectionH: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  navTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginTop: 6, marginBottom: 2 },
  navItem: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  navItemOn: { backgroundColor: '#eff6ff' },
  navText: { fontSize: 14, color: '#334155' },
  navTextOn: { color: '#1d4ed8', fontWeight: '700' },
  navPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f1f5f9' },
  navPillText: { fontSize: 13, color: '#475569' },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 16 },
});
