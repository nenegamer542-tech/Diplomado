import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, apiText } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../../design-system/tokens';
import { TTButton, TTStatCard } from '../../design-system/components';
import { money } from '../../lib/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const currentYear = new Date().getFullYear();

const TABS = [
  { key: 'kpis', label: 'KPIs generales' },
  { key: 'sales', label: 'Ventas' },
  { key: 'purchases', label: 'Compras' },
  { key: 'finance', label: 'Finanzas' },
  { key: 'budgets', label: 'Presupuestos' },
  { key: 'inventory', label: 'Inventario' },
];

function useReport(path, query, enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const key = JSON.stringify(query);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    api(path, { query })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, key, enabled, tick]);

  return { data, loading, error, reload: useCallback(() => setTick((t) => t + 1), []) };
}

function Table({ columns, rows, empty }) {
  if (!rows || rows.length === 0) return <Text style={styles.empty}>{empty || 'Sin datos.'}</Text>;
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.trHead]}>
        {columns.map((c) => (
          <Text key={c.key} style={[styles.th, { minWidth: c.width || 100 }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr}>
          {columns.map((c) => (
            <View key={c.key} style={{ minWidth: c.width || 100, paddingVertical: 8, paddingRight: 6 }}>
              {c.render ? c.render(r) : <Text style={styles.td}>{String(r[c.key] ?? '—')}</Text>}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Reportes (FASE 5): KPI, ventas, compras, finanzas, presupuestos e inventario. */
export default function ReportsScreen() {
  const { can } = useAuth();
  const [tab, setTab] = useState('kpis');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState('');
  const [exportError, setExportError] = useState('');

  const rangeOk = (v) => v === '' || DATE_RE.test(v);
  const yearOk = /^\d{4}$/.test(year);

  const query = React.useMemo(() => {
    if (tab === 'budgets') {
      const q = { year: Number(year) };
      if (/^\d{1,2}$/.test(month)) q.month = Number(month);
      return q;
    }
    const q = {};
    if (rangeOk(from) && from) q.from = from;
    if (rangeOk(to) && to) q.to = to;
    return q;
  }, [tab, from, to, year, month]);

  const enabled = tab === 'budgets' ? yearOk : rangeOk(from) && rangeOk(to);
  const report = useReport(`/reports/${tab}`, query, enabled);

  const exportCsv = async () => {
    setExportError('');
    try {
      const parts = [];
      if (rangeOk(from) && from) parts.push(`from=${from}`);
      if (rangeOk(to) && to) parts.push(`to=${to}`);
      const qs = parts.length ? `?${parts.join('&')}` : '';
      const csv = await apiText(`/reports/finance/export${qs}`);
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `movimientos-financieros-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Exportación', 'La descarga CSV está disponible en la versión web.');
      }
    } catch (e) {
      setExportError(e.message);
    }
  };

  const d = report.data;

  const renderTab = () => {
    if (!enabled) return <Text style={styles.empty}>Complete un rango de fechas válido (AAAA-MM-DD).</Text>;
    if (report.loading) return <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />;
    if (report.error) return <Text style={styles.error}>{report.error}</Text>;
    if (!d) return null;

    if (tab === 'kpis') {
      return (
        <>
          <View style={styles.cards}>
            <TTStatCard label="Ventas Aprobadas" value={money(d.sales?.total)} icon="📈" accentColor={COLORS.accent} />
            <TTStatCard label="Compras Aprobadas" value={money(d.purchases?.total)} icon="🛒" accentColor={COLORS.info} />
            <TTStatCard label="Ingresos" value={money(d.income?.total)} icon="💰" accentColor={COLORS.accent} />
            <TTStatCard label="Gastos" value={money(d.expense?.total)} icon="📉" accentColor={COLORS.error} />
            <TTStatCard label="Resultado Neto" value={money(d.net)} icon="📊" accentColor={(d.net ?? 0) >= 0 ? COLORS.accent : COLORS.error} />
          </View>
          <View style={styles.cards}>
            <TTStatCard label="Productos Activos" value={String(d.catalog?.products ?? 0)} icon="📦" />
            <TTStatCard label="Clientes" value={String(d.catalog?.customers ?? 0)} icon="👥" />
            <TTStatCard label="Proveedores" value={String(d.catalog?.suppliers ?? 0)} icon="🏢" />
            <TTStatCard label="Stock Bajo" value={String(d.catalog?.lowStock ?? 0)} icon="⚠️" accentColor={COLORS.error} />
          </View>
        </>
      );
    }

    if (tab === 'sales' || tab === 'purchases') {
      const title = tab === 'sales' ? 'Ventas' : 'Compras';
      return (
        <>
          <Text style={styles.h2}>{title} por estado</Text>
          <Table
            columns={[
              { key: 'status', label: 'Estado', width: 130, render: (r) => <StatusBadge value={r.status} /> },
              { key: 'count', label: 'Órdenes', width: 90 },
              { key: 'total', label: 'Total', width: 130, render: (r) => <Text style={styles.td}>{money(r.total)}</Text> },
            ]}
            rows={d.byStatus}
            empty={`Sin ${title.toLowerCase()} en el rango.`}
          />
          <Text style={styles.h2}>{title} aprobadas por mes</Text>
          <Table
            columns={[
              { key: 'month', label: 'Mes', width: 100 },
              { key: 'count', label: 'Órdenes', width: 90 },
              { key: 'total', label: 'Total', width: 130, render: (r) => <Text style={styles.td}>{money(r.total)}</Text> },
            ]}
            rows={d.byMonth}
            empty="Sin series mensuales en el rango."
          />
        </>
      );
    }

    if (tab === 'finance') {
      return (
        <>
          <View style={styles.cards}>
            <TTStatCard label="Ingresos" value={money(d.income?.total)} icon="📈" accentColor={COLORS.accent} />
            <TTStatCard label="Gastos" value={money(d.expense?.total)} icon="📉" accentColor={COLORS.error} />
            <TTStatCard label="Neto" value={money(d.net)} icon="💰" accentColor={(d.net ?? 0) >= 0 ? COLORS.accent : COLORS.error} />
            <TTStatCard label="Saldo en Cuentas" value={money(d.cash?.accountsBalance)} icon="💳" />
          </View>
          <Text style={styles.h2}>Ingresos por categoría</Text>
          <Table
            columns={[
              { key: 'category', label: 'Categoría', width: 160 },
              { key: 'count', label: 'Mov.', width: 70 },
              { key: 'total', label: 'Total', width: 130, render: (r) => <Text style={styles.td}>{money(r.total)}</Text> },
            ]}
            rows={d.incomeByCategory}
            empty="Sin ingresos en el rango."
          />
          <Text style={styles.h2}>Gastos por categoría</Text>
          <Table
            columns={[
              { key: 'category', label: 'Categoría', width: 160 },
              { key: 'count', label: 'Mov.', width: 70 },
              { key: 'total', label: 'Total', width: 130, render: (r) => <Text style={styles.td}>{money(r.total)}</Text> },
            ]}
            rows={d.expenseByCategory}
            empty="Sin gastos en el rango."
          />
          <Text style={styles.h2}>Cuentas</Text>
          <Table
            columns={[
              { key: 'code', label: 'Código', width: 90 },
              { key: 'name', label: 'Nombre', width: 160 },
              { key: 'currency', label: 'Moneda', width: 80 },
              { key: 'balance', label: 'Saldo', width: 120, render: (r) => <Text style={styles.td}>{money(r.balance)}</Text> },
              { key: 'status', label: 'Estado', width: 100, render: (r) => <StatusBadge value={r.status} /> },
            ]}
            rows={d.cash?.accounts}
            empty="Sin cuentas."
          />
        </>
      );
    }

    if (tab === 'budgets') {
      return (
        <>
          <View style={styles.cards}>
            <TTStatCard label="Planeado" value={money(d.totals?.planned)} icon="📋" />
            <TTStatCard label="Ejecutado" value={money(d.totals?.executed)} icon="💸" accentColor={COLORS.error} />
            <TTStatCard label="Variación" value={money(d.totals?.variance)} icon="📊" accentColor={(d.totals?.variance ?? 0) >= 0 ? COLORS.accent : COLORS.error} />
          </View>
          <Table
            columns={[
              { key: 'category', label: 'Categoría', width: 150 },
              { key: 'planned', label: 'Planeado', width: 110, render: (r) => <Text style={styles.td}>{money(r.planned)}</Text> },
              { key: 'actual', label: 'Ejecutado', width: 110, render: (r) => <Text style={styles.td}>{money(r.actual)}</Text> },
              { key: 'variance', label: 'Variación', width: 110, render: (r) => <Text style={styles.td}>{money(r.variance)}</Text> },
              {
                key: 'utilization',
                label: 'Uso %',
                width: 80,
                render: (r) => <Text style={styles.td}>{r.utilization === null || r.utilization === undefined ? '—' : `${r.utilization}%`}</Text>,
              },
            ]}
            rows={d.items}
            empty="Sin presupuestos para el año indicado."
          />
        </>
      );
    }

    // inventory
    return (
      <>
        <View style={styles.cards}>
          <TTStatCard label="Valor a costo" value={money(d.totalValue)} icon="💰" />
          <TTStatCard label="Unidades" value={String(d.totalQuantity ?? 0)} icon="📦" />
          <TTStatCard label="Stock bajo" value={String(d.lowStock ?? 0)} icon="⚠️" accentColor={COLORS.error} />
        </View>
        <Table
          columns={[
            { key: 'sku', label: 'SKU', width: 110 },
            { key: 'name', label: 'Producto', width: 190 },
            { key: 'quantity', label: 'Cant.', width: 80 },
            { key: 'costPrice', label: 'Costo', width: 100, render: (r) => <Text style={styles.td}>{money(r.costPrice)}</Text> },
            { key: 'value', label: 'Valor', width: 120, render: (r) => <Text style={styles.td}>{money(r.value)}</Text> },
          ]}
          rows={d.items}
          empty="Sin existencias valorizadas."
        />
      </>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabOn]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbar}>
        {tab === 'budgets' ? (
          <>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Año</Text>
              <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Mes (1-12)</Text>
              <TextInput style={styles.input} value={month} onChangeText={setMonth} keyboardType="numeric" placeholder="(anual)" placeholderTextColor={COLORS.textMuted} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Desde</Text>
              <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Hasta</Text>
              <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.textMuted} />
            </View>
          </>
        )}
        <TTButton variant="secondary" size="md" onPress={report.reload}>
          Actualizar
        </TTButton>
        {can('reports.export') ? (
          <TTButton variant="primary" size="md" onPress={exportCsv}>
            Exportar CSV
          </TTButton>
        ) : null}
      </View>

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      {renderTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.md },
  tabs: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  tab: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabOn: { backgroundColor: `${COLORS.accent}20`, borderColor: COLORS.accent },
  tabText: { fontSize: TYPOGRAPHY.fontSize.xs + 1, fontWeight: TYPOGRAPHY.fontWeight.medium, color: COLORS.textMuted },
  tabTextOn: { color: COLORS.accent, fontWeight: TYPOGRAPHY.fontWeight.bold },
  toolbar: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-end', flexWrap: 'wrap' },
  dateBox: { gap: SPACING.xs, width: 150 },
  label: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  cards: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  h2: { fontSize: TYPOGRAPHY.fontSize.md, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.textPrimary, marginTop: SPACING.xs },
  table: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trHead: { backgroundColor: COLORS.surface },
  th: { paddingVertical: SPACING.md, paddingRight: SPACING.sm, fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.textMuted, textTransform: 'uppercase' },
  td: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textPrimary },
  empty: { color: COLORS.textMuted, fontSize: TYPOGRAPHY.fontSize.sm, paddingVertical: SPACING.sm },
  error: { color: COLORS.error, fontSize: TYPOGRAPHY.fontSize.sm },
});
