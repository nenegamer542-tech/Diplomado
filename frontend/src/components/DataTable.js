import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Tabla genérica de listados (todas las pantallas FASE 7 la reutilizan):
 * título + "Nuevo" + búsqueda + columna de acciones + paginación del backend.
 * columnas: [{ key, label, render?(row) }] · rowActions(row) → [{ label, onPress, danger }]
 */
export default function DataTable({
  title,
  subtitle,
  columns = [],
  rows = [],
  loading = false,
  error = null,
  search = '',
  onSearchChange,
  onRefresh,
  page = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onCreate,
  createLabel = 'Nuevo',
  rowActions,
  emptyText = 'Sin registros.',
}) {
  const [draft, setDraft] = useState(search);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const apply = (value) => {
    setDraft(value);
    if (onSearchChange) onSearchChange(value);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          {onRefresh ? (
            <Pressable style={[styles.btn, styles.ghost]} onPress={onRefresh}>
              <Text style={styles.ghostText}>Actualizar</Text>
            </Pressable>
          ) : null}
          {onCreate ? (
            <Pressable style={[styles.btn, styles.primary]} onPress={onCreate}>
              <Text style={styles.primaryText}>{createLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {onSearchChange ? (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={draft}
            onChangeText={apply}
            placeholder="Buscar…"
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.tableBox}>
        <ScrollView horizontal contentContainerStyle={styles.tableScroll}>
          <View>
            <View style={[styles.row, styles.headRow]}>
              {columns.map((c) => (
                <Text key={c.key} style={[styles.th, { minWidth: c.width || 120 }]}>
                  {c.label}
                </Text>
              ))}
              {rowActions ? <Text style={[styles.th, styles.thActions]}>Acciones</Text> : null}
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#2563eb" />
              </View>
            ) : rows.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.empty}>{error ? '—' : emptyText}</Text>
              </View>
            ) : (
              rows.map((row) => (
                <View key={String(row._id)} style={styles.row}>
                  {columns.map((c) => (
                    <View key={c.key} style={{ minWidth: c.width || 120, paddingVertical: 10, paddingRight: 8 }}>
                      {c.render ? c.render(row) : <Text style={styles.td}>{formatCell(row[c.key])}</Text>}
                    </View>
                  ))}
                  {rowActions ? (
                    <View style={styles.actions}>
                      {rowActions(row).map((a) => (
                        <Pressable
                          key={a.label}
                          style={[styles.actionBtn, a.danger && styles.actionDanger]}
                          onPress={a.onPress}
                        >
                          <Text style={[styles.actionText, a.danger && styles.actionDangerText]}>
                            {a.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {from}–{to} de {total} · página {page}/{totalPages}
        </Text>
        {onPageChange ? (
          <View style={styles.pager}>
            <Pressable
              style={[styles.pageBtn, page <= 1 && styles.pageOff]}
              disabled={page <= 1}
              onPress={() => onPageChange(page - 1)}
            >
              <Text style={styles.pageBtnText}>‹</Text>
            </Pressable>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageOff]}
              disabled={page >= totalPages}
              onPress={() => onPageChange(page + 1)}
            >
              <Text style={styles.pageBtnText}>›</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatCell(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return v.name || v.code || v._id || '—';
  if (typeof v === 'number') return String(v);
  return String(v);
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  headerText: { gap: 2 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b' },
  headerActions: { flexDirection: 'row', gap: 8 },
  btn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  primary: { backgroundColor: '#2563eb' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  ghost: { backgroundColor: '#f1f5f9' },
  ghostText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: 8 },
  search: {
    flex: 1,
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#0f172a',
  },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  tableBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tableScroll: { minWidth: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headRow: { backgroundColor: '#f8fafc' },
  th: { paddingVertical: 10, paddingRight: 8, fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  thActions: { minWidth: 160 },
  td: { fontSize: 14, color: '#0f172a' },
  actions: { flexDirection: 'row', gap: 6, paddingVertical: 8, minWidth: 160, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  actionDanger: { backgroundColor: '#fef2f2' },
  actionDangerText: { color: '#b91c1c' },
  center: { paddingVertical: 28, alignItems: 'center' },
  empty: { color: '#64748b', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { color: '#64748b', fontSize: 13 },
  pager: { flexDirection: 'row', gap: 6 },
  pageBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pageOff: { opacity: 0.4 },
  pageBtnText: { fontSize: 18, color: '#334155' },
});
