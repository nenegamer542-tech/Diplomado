import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../design-system/tokens';
import {
  TTBadge,
  TTButton,
  TTCard,
  TTStatCard,
} from '../design-system/components';
import { MENU_CATEGORIES } from '../components/Layout';
import { dateOf, money } from '../lib/format';
import { useNav } from '../nav/RouterContext';

/**
 * TECTODE Dashboard Enterprise - HomeScreen
 */
export default function HomeScreen() {
  const { session, can } = useAuth();
  const { go } = useNav();

  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState([]);

  const { user, role, company, branch } = session || {};

  useEffect(() => {
    let cancelled = false;

    // Carga de KPIs si el usuario tiene permiso
    if (can('reports.read')) {
      api('/reports/kpis')
        .then((data) => {
          if (!cancelled) setKpis(data);
        })
        .catch(() => {
          if (!cancelled) setKpis(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    // Carga opcional de auditoría reciente para el feed
    if (can('audit.read')) {
      api('/audit', { query: { limit: 5 } })
        .then((data) => {
          if (!cancelled && Array.isArray(data)) setAuditLog(data);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [can]);

  const filteredCategories = MENU_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => item.permission && can(item.permission)),
  })).filter((cat) => cat.items.length > 0);

  const todayStr = dateOf(new Date());

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* BANNER HERO TEK / SALUDO */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTextGroup}>
            <View style={styles.companyRow}>
              <TTBadge value="active" label={company?.name || 'Tec[ode ERP'} variant="accent" />
              <Text style={styles.todayText}>📅 {todayStr}</Text>
            </View>
            <Text style={styles.greetingTitle}>
              Buenos días, <Text style={styles.userNameHighlight}>{user?.name || 'Operador'}</Text>
            </Text>
            <Text style={styles.greetingSubtitle}>
              Aquí tienes el resumen operativo y comercial en tiempo real de tu negocio.
            </Text>
          </View>

          {/* ACCIONES RÁPIDAS EN HERO */}
          <View style={styles.quickActionsGroup}>
            {can('products.create') ? (
              <TTButton variant="primary" size="sm" onPress={() => go('products')}>
                + Producto
              </TTButton>
            ) : null}
            {can('purchases.create') ? (
              <TTButton variant="secondary" size="sm" onPress={() => go('purchaseOrders')}>
                + Compra
              </TTButton>
            ) : null}
            {can('sales.orders.create') ? (
              <TTButton variant="brand" size="sm" onPress={() => go('salesOrders')}>
                + Venta
              </TTButton>
            ) : null}
          </View>
        </View>

        {/* METADATOS DE SESIÓN */}
        <View style={styles.sessionMetaBar}>
          <Text style={styles.metaText}>
            👤 Usuario: <Text style={styles.metaVal}>{user?.email}</Text>
          </Text>
          <Text style={styles.metaDivider}>•</Text>
          <Text style={styles.metaText}>
            🛡️ Rol: <Text style={styles.metaVal}>{role?.label || role?.code || 'Usuario'}</Text>
          </Text>
          {branch ? (
            <>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.metaText}>
                📍 Sucursal: <Text style={styles.metaVal}>{branch.name}</Text>
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {/* METRICAS Y KPIS EMPRESARIALES */}
      {can('reports.read') ? (
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Métricas Principales</Text>
          <View style={styles.kpiGrid}>
            <TTStatCard
              label="Ventas Aprobadas"
              value={money(kpis?.sales?.total || 0)}
              trend={`${kpis?.sales?.count || 0} órdenes`}
              trendType="positive"
              icon="📈"
              accentColor={COLORS.accent}
            />
            <TTStatCard
              label="Compras Aprobadas"
              value={money(kpis?.purchases?.total || 0)}
              trend={`${kpis?.purchases?.count || 0} compras`}
              trendType="neutral"
              icon="🛒"
              accentColor={COLORS.info}
            />
            <TTStatCard
              label="Resultado Neto"
              value={money(kpis?.net || 0)}
              trend={(kpis?.net ?? 0) >= 0 ? 'Rentable' : 'Déficit'}
              trendType={(kpis?.net ?? 0) >= 0 ? 'positive' : 'negative'}
              icon="💰"
              accentColor={(kpis?.net ?? 0) >= 0 ? COLORS.accent : COLORS.error}
            />
            <TTStatCard
              label="Stock Bajo / Alertas"
              value={String(kpis?.catalog?.lowStock ?? 0)}
              trend={`${kpis?.catalog?.totalProducts || 0} catálogo total`}
              trendType={(kpis?.catalog?.lowStock ?? 0) > 0 ? 'negative' : 'positive'}
              icon="⚠️"
              accentColor={(kpis?.catalog?.lowStock ?? 0) > 0 ? COLORS.error : COLORS.accent}
            />
          </View>
        </View>
      ) : null}

      {/* PANEL PRINCIPAL: SALUD OPERATIVA + ACTIVIDAD RECIENTE */}
      <View style={styles.splitGrid}>
        {/* PANEL IZQUIERDO: SALUD DEL SISTEMA */}
        <TTCard
          title="Estado Operativo Tec[ode"
          subtitle="Monitoreo de componentes integrados"
          style={styles.splitCard}
        >
          <View style={styles.healthList}>
            <View style={styles.healthItem}>
              <View style={styles.healthLeft}>
                <Text style={styles.healthIcon}>📦</Text>
                <View>
                  <Text style={styles.healthTitle}>Inventario & Almacenes</Text>
                  <Text style={styles.healthSub}>Sincronización multi-depósito activa</Text>
                </View>
              </View>
              <TTBadge value="active" label="Optimo" />
            </View>

            <View style={styles.healthItem}>
              <View style={styles.healthLeft}>
                <Text style={styles.healthIcon}>💳</Text>
                <View>
                  <Text style={styles.healthTitle}>Finanzas & Saldos</Text>
                  <Text style={styles.healthSub}>Mecanismo de concurrencia optimista activo</Text>
                </View>
              </View>
              <TTBadge value="active" label="Operativo" />
            </View>

            <View style={styles.healthItem}>
              <View style={styles.healthLeft}>
                <Text style={styles.healthIcon}>🛡️</Text>
                <View>
                  <Text style={styles.healthTitle}>Seguridad & Multi-tenant</Text>
                  <Text style={styles.healthSub}>Aislamiento de datos validado por token</Text>
                </View>
              </View>
              <TTBadge value="POSTED" label="Protegido" />
            </View>
          </View>
        </TTCard>

        {/* PANEL DERECHO: ACTIVIDAD / AUDITORÍA RECIENTE */}
        <TTCard
          title="Actividad Reciente"
          subtitle="Registro en vivo de eventos del sistema"
          action={
            can('audit.read') ? (
              <TTButton variant="ghost" size="sm" onPress={() => go('audit')}>
                Ver todo →
              </TTButton>
            ) : null
          }
          style={styles.splitCard}
        >
          {auditLog.length > 0 ? (
            <View style={styles.auditFeed}>
              {auditLog.map((log) => (
                <View key={String(log._id)} style={styles.auditRow}>
                  <View style={styles.auditIconWrapper}>
                    <Text style={styles.auditIcon}>👁️</Text>
                  </View>
                  <View style={styles.auditContent}>
                    <Text style={styles.auditAction}>
                      {log.action} <Text style={styles.auditEntity}>({log.entity})</Text>
                    </Text>
                    <Text style={styles.auditMeta}>
                      {log.user?.email || 'Sistema'} · {dateOf(log.createdAt, true)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Sin actividad reciente registrada.</Text>
          )}
        </TTCard>
      </View>

      {/* ACCESOS DIRECTOS A MÓDULOS */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Módulos y Operaciones</Text>
        {filteredCategories.map((cat) => (
          <View key={cat.category} style={styles.moduleCategoryBox}>
            <Text style={styles.moduleCategoryTitle}>{cat.category}</Text>
            <View style={styles.tilesGrid}>
              {cat.items.map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() => go(item.route)}
                  style={({ hovered }) => [
                    styles.tile,
                    hovered && styles.tileHovered,
                  ]}
                >
                  <Text style={styles.tileIcon}>{item.icon}</Text>
                  <View style={styles.tileTextArea}>
                    <Text style={styles.tileTitle}>{item.label}</Text>
                    <Text style={styles.tileSub}>Acceder al módulo</Text>
                  </View>
                  <Text style={styles.tileArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xl,
    paddingBottom: SPACING['3xl'],
  },

  // Hero Card
  heroCard: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.lg,
    flexWrap: 'wrap',
  },
  heroTextGroup: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 280,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  todayText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  greetingTitle: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  userNameHighlight: {
    color: COLORS.accent,
  },
  greetingSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  quickActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  sessionMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  metaVal: {
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  metaDivider: {
    color: COLORS.textMuted,
    fontSize: 10,
  },

  // Section
  sectionGroup: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },

  // Split Grid
  splitGrid: {
    flexDirection: 'row',
    gap: SPACING.lg,
    flexWrap: 'wrap',
  },
  splitCard: {
    flex: 1,
    minWidth: 320,
  },

  // Health List
  healthList: {
    gap: SPACING.md,
  },
  healthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  healthLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  healthIcon: {
    fontSize: 20,
  },
  healthTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm + 1,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  healthSub: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
  },

  // Audit Feed
  auditFeed: {
    gap: SPACING.md,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  auditIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditIcon: {
    fontSize: 14,
  },
  auditContent: {
    flex: 1,
    gap: 2,
  },
  auditAction: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  auditEntity: {
    color: COLORS.accent,
  },
  auditMeta: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  // Module Category Box & Tiles
  moduleCategoryBox: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  moduleCategoryTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tilesGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minWidth: 220,
    flex: 1,
  },
  tileHovered: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardElevated,
  },
  tileIcon: {
    fontSize: 22,
  },
  tileTextArea: {
    flex: 1,
    gap: 1,
  },
  tileTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  tileSub: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
  },
  tileArrow: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.accent,
    fontWeight: '700',
  },
});
