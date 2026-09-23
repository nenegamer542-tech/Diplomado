import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Formato monetario y fechas compartido por las pantallas FASE 7. */
export const money = (n) => {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  if (Number.isNaN(v)) return String(n);
  return `$${v.toFixed(2)}`;
};

export const dateOf = (v, withTime = false) => {
  if (!v) return '—';
  try {
    const d = new Date(v);
    return withTime ? d.toLocaleString() : d.toLocaleDateString();
  } catch {
    return String(v);
  }
};

/** Nombre legible de una referencia (id, doc poblado o catálogo de opciones). */
export const labelFor = (v, labels = {}) => {
  if (v && typeof v === 'object') return v.name || v.sku || v.code || String(v._id);
  if (!v) return '—';
  return labels[v] || String(v);
};

/** Invierte { value: label } para búsquedas id → etiqueta. */
export const invert = (options = []) => {
  const map = {};
  for (const o of options) map[o.value] = o.label;
  return map;
};

/**
 * Modal de solo lectura: pares etiqueta/valor, tabla opcional de líneas
 * y bloque opcional de texto monoespaciado (auditoría JSON).
 */
export default function DetailModal({ visible, title, entries = [], columns, rows, raw, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.body}>
            {entries.map((e) => (
              <View key={e.label} style={styles.entry}>
                <Text style={styles.k}>{e.label}</Text>
                <View style={styles.vBox}>{e.value}</View>
              </View>
            ))}

            {rows && rows.length > 0 ? (
              <View style={styles.table}>
                <View style={[styles.tr, styles.thead]}>
                  {(columns || []).map((c) => (
                    <Text key={c.key} style={[styles.th, { minWidth: c.width || 90 }]}>
                      {c.label}
                    </Text>
                  ))}
                </View>
                {rows.map((row, idx) => (
                  <View key={String(row._id ?? idx)} style={styles.tr}>
                    {(columns || []).map((c) => (
                      <View key={c.key} style={{ minWidth: c.width || 90, paddingVertical: 6, paddingRight: 6 }}>
                        {c.render ? c.render(row) : <Text style={styles.td}>{String(row[c.key] ?? '—')}</Text>}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {raw ? <Text style={styles.raw}>{raw}</Text> : null}
          </ScrollView>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0f172a66', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { gap: 8 },
  entry: { flexDirection: 'row', gap: 10, paddingVertical: 4, flexWrap: 'wrap' },
  k: { fontSize: 13, color: '#64748b', minWidth: 130 },
  vBox: { flex: 1, minWidth: 160 },
  table: { marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  thead: { backgroundColor: '#f8fafc' },
  th: { paddingVertical: 8, paddingRight: 6, fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  td: { fontSize: 13, color: '#0f172a' },
  raw: {
    marginTop: 12,
    fontSize: 12,
    color: '#334155',
    fontFamily: 'monospace',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
  },
  close: { alignSelf: 'flex-end', backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  closeText: { color: '#334155', fontWeight: '600' },
});
