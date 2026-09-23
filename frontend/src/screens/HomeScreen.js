import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MENU } from '../components/Layout';
import { useNav } from '../nav/RouterContext';
import { money } from '../lib/format';

/**
 * Dashboard FASE 7: saludo con contexto de sesión + KPI (si hay permiso de
 * reportes) + accesos agrupados por sección (los mismos del menú lateral).
 */
export default function HomeScreen() {
  const { session, can } = useAuth();
  const { go } = useNav();
  const [kpis, setKpis] = useState(null);

  const { user, role, company, branch } = session || {};

  useEffect(() => {
    if (!can('reports.read')) return undefined;
    let cancelled = false;
    api('/reports/kpis')
      .then((d) => {
        if (!cancelled) setKpis(d);
      })
      .catch(() => {
        if (!cancelled) setKpis(null);
      });
    return () => {
      cancelled = true;
    };
  }, [can]);

  const sections = MENU.map((s) => ({
    ...s,
    items: s.items.filter((i) => can(i.permission)),
  })).filter((s) => s.items.length > 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.h1}>{company?.name || 'ERP Multiempresa'}</Text>
          <Text style={styles.muted}>
            Hola, {user?.name} · {role?.label || role?.code || 'Sin rol'}
            {branch ? ` · Sucursal ${branch.name}` : ''}
          </Text>
        </View>
      </View>

      {kpis ? (
        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Ventas aprobadas</Text>
            <Text style={[styles.cardValue, styles.good]}>{money(kpis.sales?.total)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Compras aprobadas</Text>
            <Text style={styles.cardValue}>{money(kpis.purchases?.total)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Resultado neto</Text>
            <Text style={[styles.cardValue, (kpis.net ?? 0) >= 0 ? styles.good : styles.bad]}>{money(kpis.net)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Productos con stock bajo</Text>
            <Text style={[styles.cardValue, styles.bad]}>{String(kpis.catalog?.lowStock ?? 0)}</Text>
          </View>
        </View>
      ) : null}

      {sections.map((s) => (
        <View key={s.section} style={styles.section}>
          <Text style={styles.h2}>{s.section}</Text>
          <View style={styles.grid}>
            {s.items.map((item) => (
              <Pressable key={item.route} style={styles.tile} onPress={() => go(item.route)}>
                <Text style={styles.tileText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  hero: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
  },
  h1: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  muted: { fontSize: 13, color: '#64748b', marginTop: 4 },
  cards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 150,
    gap: 4,
  },
  cardLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  good: { color: '#047857' },
  bad: { color: '#b91c1c' },
  section: { gap: 8 },
  h2: { fontSize: 15, fontWeight: '700', color: '#334155' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 150,
  },
  tileText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
});
