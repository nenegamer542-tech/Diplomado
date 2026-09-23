import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Dropdown from './Dropdown';

/**
 * Modal de formulario genérico: los screens declaran `fields` y sólo
 * implementan onSubmit(values). El estado vive AQUÍ (no en el screen).
 *
 * tipos de campo: text | textarea | number | select | date | checkbox | lines
 *  - select vacío ⇒ el campo NO se envía (evita "Identificador inválido").
 *  - number: si el usuario escribe texto no numérico se envía tal cual y el
 *    backend responde el mensaje canónico en español (Zod invalid_type).
 *  - required vacío ⇒ validación en español aquí mismo (evita "Required" de Zod).
 *  - lines: editor de líneas (órdenes de compra/venta y componentes de BOM).
 */

function toInitial(fields, initial) {
  const values = {};
  for (const f of fields) {
    const v = initial ? initial[f.name] : undefined;
    if (f.type === 'permissions') {
      values[f.name] = Array.isArray(v) ? [...v] : [];
    } else if (f.type === 'lines') {
      values[f.name] = Array.isArray(v) ? v.map((r) => ({ ...r })) : [];
    } else if (f.type === 'checkbox') {
      values[f.name] = v === undefined ? Boolean(f.defaultValue) : Boolean(v);
    } else if (v === undefined || v === null) {
      values[f.name] = f.defaultValue !== undefined ? String(f.defaultValue) : '';
    } else if (typeof v === 'object') {
      values[f.name] = v._id ? String(v._id) : '';
    } else {
      values[f.name] = String(v);
    }
  }
  return values;
}

function buildPayload(fields, values) {
  const payload = {};
  const problems = [];

  for (const f of fields) {
    const raw = values[f.name];

    if (f.type === 'permissions') {
      payload[f.name] = Array.isArray(raw) ? raw : [];
      continue;
    }

    if (f.type === 'lines') {
      const rows = Array.isArray(raw) ? raw : [];
      if (f.required && rows.length === 0) {
        problems.push(`'${f.label}': agregue al menos una línea.`);
        continue;
      }
      const built = [];
      let incomplete = false;
      for (const row of rows) {
        const item = {};
        for (const it of f.itemFields || []) {
          let v = row[it.name];
          if (v === undefined || v === null) v = '';
          if (it.type === 'number') {
            const s = String(v).trim();
            if (s === '') {
              if (it.required) incomplete = true;
              continue;
            }
            v = Number.isNaN(Number(s)) ? s : Number(s);
          } else if (v === '') {
            if (it.required) incomplete = true;
            continue;
          }
          item[it.name] = v;
        }
        if (incomplete) break;
        built.push(item);
      }
      if (incomplete) {
        problems.push(`'${f.label}': complete todos los campos de cada línea.`);
        continue;
      }
      payload[f.name] = built;
      continue;
    }

    if (f.type === 'checkbox') {
      payload[f.name] = Boolean(raw);
      continue;
    }

    const v = raw === undefined || raw === null ? '' : String(raw).trim();
    if (v === '') {
      if (f.required) problems.push(`'${f.label}' es obligatorio.`);
      continue;
    }
    if (f.type === 'number') {
      payload[f.name] = Number.isNaN(Number(v)) ? v : Number(v);
      continue;
    }
    payload[f.name] = v;
  }

  return { payload, problems };
}

function LinesEditor({ field, rows, onChange }) {
  const itemFields = field.itemFields || [];

  const update = (idx, name, value) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [name]: value } : r)));
  };

  const add = () => {
    const blank = {};
    for (const it of itemFields) blank[it.name] = it.defaultValue !== undefined ? String(it.defaultValue) : '';
    onChange([...rows, blank]);
  };

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, idx) => (
        <View key={`line-${idx}`} style={styles.lineRow}>
          {itemFields.map((it) => (
            <View key={it.name} style={styles.lineCell}>
              <Text style={styles.lineLabel}>{it.label}</Text>
              {it.type === 'select' ? (
                <Dropdown
                  value={row[it.name] || null}
                  onChange={(v) => update(idx, it.name, v)}
                  options={it.options || []}
                  placeholder={it.placeholder || 'Seleccione…'}
                />
              ) : (
                <TextInput
                  style={styles.lineInput}
                  value={row[it.name] === undefined || row[it.name] === null ? '' : String(row[it.name])}
                  onChangeText={(t) => update(idx, it.name, t)}
                  keyboardType={it.type === 'number' ? 'numeric' : 'default'}
                  placeholder={it.placeholder || ''}
                  placeholderTextColor="#94a3b8"
                />
              )}
            </View>
          ))}
          <Pressable style={styles.lineRemove} onPress={() => onChange(rows.filter((_, i) => i !== idx))}>
            <Text style={styles.lineRemoveText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.lineAdd} onPress={add}>
        <Text style={styles.lineAddText}>+ Agregar línea</Text>
      </Pressable>
    </View>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <Pressable style={styles.checkRow} onPress={() => onChange(!checked)}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.boxMark}>✓</Text> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/** Selector de permisos agrupados (chips conmutables) para el editor de roles. */
function PermissionPicker({ groups, value, onChange }) {
  const toggle = (perm) => {
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm]);
  };
  const selectGroup = (items) => {
    onChange([...new Set([...value, ...items])]);
  };

  if (groups.length === 0) return <Text style={styles.hint}>Sin permisos disponibles.</Text>;

  return (
    <View style={{ gap: 10 }}>
      {groups.map((g) => (
        <View key={g.name} style={{ gap: 6 }}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{g.name}</Text>
            <Pressable style={styles.groupAll} onPress={() => selectGroup(g.items)}>
              <Text style={styles.groupAllText}>Todos</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {g.items.map((perm) => {
              const on = value.includes(perm);
              return (
                <Pressable key={perm} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(perm)}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{perm}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Text style={styles.hint}>{value.length} permisos seleccionados</Text>
    </View>
  );
}

export default function FormModal({ visible, title, fields = [], initial = null, onSubmit, onCancel }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Refs: los arrays `fields`/`initial` se recrean en cada render del screen.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (visible) {
      setValues(toInitial(fieldsRef.current, initialRef.current));
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const set = (name, value) => setValues((p) => ({ ...p, [name]: value }));

  const handleSave = async () => {
    setError(null);
    const { payload, problems } = buildPayload(fieldsRef.current, values);
    if (problems.length) {
      setError(problems.join(' '));
      return;
    }
    setBusy(true);
    try {
      await submitRef.current(payload);
    } catch (e) {
      const detail = Array.isArray(e.details)
        ? ` ${e.details.map((d) => d.message).join(' ')}`
        : '';
      setError(`${e.message || 'Ocurrió un error. Intente de nuevo.'}${detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {fieldsRef.current.map((f) =>
              f.type === 'permissions' ? (
                <View key={f.name} style={styles.field}>
                  <Text style={styles.label}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </Text>
                  <PermissionPicker
                    groups={f.groups || []}
                    value={values[f.name] || []}
                    onChange={(v) => set(f.name, v)}
                  />
                </View>
              ) : f.type === 'lines' ? (
                <View key={f.name} style={styles.field}>
                  <Text style={styles.label}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </Text>
                  <LinesEditor
                    field={f}
                    rows={values[f.name] || []}
                    onChange={(v) => set(f.name, v)}
                  />
                </View>
              ) : (
                <View key={f.name} style={styles.field}>
                  <Text style={styles.label}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </Text>

                  {f.type === 'select' ? (
                    <Dropdown
                      value={values[f.name] || null}
                      onChange={(v) => set(f.name, v || '')}
                      options={f.options || []}
                      placeholder={f.placeholder || 'Seleccione…'}
                    />
                  ) : f.type === 'checkbox' ? (
                    <Checkbox
                      checked={Boolean(values[f.name])}
                      onChange={(v) => set(f.name, v)}
                      label={f.checkboxLabel || f.label}
                    />
                  ) : f.type === 'textarea' ? (
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      value={values[f.name] || ''}
                      onChangeText={(t) => set(f.name, t)}
                      multiline
                      numberOfLines={3}
                      placeholder={f.placeholder || ''}
                      placeholderTextColor="#94a3b8"
                    />
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={values[f.name] || ''}
                      onChangeText={(t) => set(f.name, t)}
                      keyboardType={f.type === 'number' ? 'numeric' : f.keyboardType || 'default'}
                      secureTextEntry={f.type === 'password'}
                      autoCapitalize={f.type === 'password' || f.keyboardType === 'email-address' ? 'none' : 'sentences'}
                      keyboardTypeHint={undefined}
                      placeholder={f.type === 'date' ? 'AAAA-MM-DD' : f.placeholder || ''}
                      placeholderTextColor="#94a3b8"
                    />
                  )}

                  {f.hint ? <Text style={styles.hint}>{f.hint}</Text> : null}
                </View>
              )
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.save, busy && styles.saveOff]} onPress={handleSave} disabled={busy}>
              <Text style={styles.saveText}>{busy ? 'Guardando…' : 'Guardar'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0f172a66', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { gap: 12 },
  field: { gap: 6, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  hint: { fontSize: 12, color: '#64748b' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  cancel: { backgroundColor: '#f1f5f9' },
  cancelText: { color: '#334155', fontWeight: '600' },
  save: { backgroundColor: '#2563eb' },
  saveOff: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '600' },
  lineRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' },
  lineCell: { flex: 1, minWidth: 110, gap: 4 },
  lineLabel: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  lineInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  lineRemove: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#fef2f2' },
  lineRemoveText: { color: '#b91c1c', fontWeight: '700' },
  lineAdd: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8 },
  lineAddText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  boxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: '#0f172a' },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { fontSize: 13, fontWeight: '700', color: '#334155' },
  groupAll: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  groupAllText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#475569' },
  chipTextOn: { color: '#fff', fontWeight: '700' },
});
