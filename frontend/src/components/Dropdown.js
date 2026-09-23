import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Selector desplegable SIN dependencias (RN no trae <select>): abre una lista
 * en línea; con más de 12 opciones muestra un filtro de búsqueda.
 * `value` es string|null; `options` = [{ value, label }].
 */
export default function Dropdown({ value, onChange, options = [], placeholder = 'Seleccione…' }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const selected = options.find((o) => String(o.value) === String(value));
  const searchable = options.length > 12;
  const visible = searchable
    ? options.filter((o) => String(o.label).toLowerCase().includes(filter.trim().toLowerCase()))
    : options;

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setFilter('');
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.control} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.caret}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {searchable ? (
            <TextInput
              style={styles.filter}
              value={filter}
              onChangeText={setFilter}
              placeholder="Buscar…"
              placeholderTextColor="#94a3b8"
              autoFocus
            />
          ) : null}
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={[{ value: '', label: placeholder }, ...visible]}
            keyExtractor={(o, idx) => `${String(o.value)}-${idx}`}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.item, String(item.value) === String(value) && styles.itemOn]}
                onPress={() => pick(item.value === '' ? null : item.value)}
              >
                <Text style={styles.itemText}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  value: { flex: 1, fontSize: 15, color: '#0f172a' },
  placeholder: { color: '#94a3b8' },
  caret: { color: '#64748b', fontSize: 12, marginLeft: 8 },
  panel: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  list: { maxHeight: 240 },
  item: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemOn: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 14, color: '#0f172a' },
});
