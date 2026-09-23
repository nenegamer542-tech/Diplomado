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
import { money } from '../../lib/format';

const TABS = [
  { key: 'kpis', label: 'KPI' },
  { key: 'sales', label: 'Ventas' },
  { key: 'purchases', label: 'Compras' },
  { key: 'finance', label: 'Finanzas' },
  { key: 'budgets', label: 'Presupuestos' },
  { key: 'inventory', label: 'Inventario' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const currentYear = new Date().getFullYear();

/** GET de reporte (no paginado) con recarga por pestaña/rango. */
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
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled, tick]);

  return { data, loading, error, reload: useCallback(() => setTick((t) => t + 1), []) };
}

function Stat({ label, value, tone }) {
  const color = tone === 'good' ? '#047857' : tone === 'bad' ? '#b91c1c' : '#0f172a';
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (report.loading) return <ActivityIndicator color="#2563eb" style={{ marginTop: 24 }} />;
    if (report.error) return <Text style={styles.error}>{report.error}</Text>;
    if (!d) return null;

    if (tab === 'kpis') {
      return (
        <>
          <View style={styles.cards}>
            <Stat label="Ventas aprobadas" value={money(d.sales?.total)} tone="good" />
            <Stat label="Compras aprobadas" value={money(d.purchases?.total)} />
            <Stat label="Ingresos" value={money(d.income?.total)} tone="good" />
            <Stat label="Gastos" value={money(d.expense?.total)} tone="bad" />
            <Stat label="Resultado neto" value={money(d.net)} tone={(d.net ?? 0) >= 0 ? 'good' : 'bad'} />
          </View>
          <View style={styles.cards}>
            <Stat label="Productos activos" value={String(d.catalog?.products ?? 0)} />
            <Stat label="Clientes" value={String(d.catalog?.customers ?? 0)} />
            <Stat label="Proveedores" value={String(d.catalog?.suppliers ?? 0)} />
            <Stat label="Stock bajo" value={String(d.catalog?.lowStock ?? 0)} tone="bad" />
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
            <Stat label="Ingresos" value={money(d.income?.total)} tone="good" />
            <Stat label="Gastos" value={money(d.expense?.total)} tone="bad" />
            <Stat label="Neto" value={money(d.net)} tone={(d.net ?? 0) >= 0 ? 'good' : 'bad'} />
            <Stat label="Saldo en cuentas" value={money(d.cash?.accountsBalance)} />
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
            <Stat label="Planeado" value={money(d.totals?.planned)} />
            <Stat label="Ejecutado" value={money(d.totals?.executed)} tone="bad" />
            <Stat label="Variación" value={money(d.totals?.variance)} tone={(d.totals?.variance ?? 0) >= 0 ? 'good' : 'bad'} />
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
          <Stat label="Valor a costo" value={money(d.totalValue)} />
          <Stat label="Unidades" value={String(d.totalQuantity ?? 0)} />
          <Stat label="Productos con stock bajo" value={String(d.lowStock ?? 0)} tone="bad" />
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
          <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabOn]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbar}>
        {tab === 'budgets' ? (
          <>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Año</Text>
              <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" placeholderTextColor="#94a3b8" />
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Mes (1-12)</Text>
              <TextInput style={styles.input} value={month} onChangeText={setMonth} keyboardType="numeric" placeholder="(anual)" placeholderTextColor="#94a3b8" />
            </View>
          </>
        ) : (
          <>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Desde</Text>
              <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="AAAA-MM-DD" placeholderTextColor="#94a3b8" />
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.label}>Hasta</Text>
              <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="AAAA-MM-DD" placeholderTextColor="#94a3b8" />
            </View>
          </>
        )}
        <Pressable style={styles.reload} onPress={report.reload}>
          <Text style={styles.reloadText}>Actualizar</Text>
        </Pressable>
        {can('reports.export') ? (
          <Pressable style={styles.export} onPress={exportCsv}>
            <Text style={styles.exportText}>Exportar CSV</Text>
          </Pressable>
        ) : null}
      </View>

      {exportError ? <Text style={styles.error}>{exportError}</Text> : null}

      {renderTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f1f5f9' },
  tabOn: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTextOn: { color: '#fff' },
  toolbar: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' },
  dateBox: { gap: 4, width: 150 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  reload: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  reloadText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  export: { backgroundColor: '#047857', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  exportText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  stat: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 150,
    gap: 4,
  },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '800' },
  h2: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 6 },
  table: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  trHead: { backgroundColor: '#f8fafc' },
  th: { paddingVertical: 9, paddingRight: 6, fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  td: { fontSize: 13, color: '#0f172a' },
  empty: { color: '#64748b', fontSize: 14, paddingVertical: 8 },
  error: { color: '#dc2626', fontSize: 13 },
});
