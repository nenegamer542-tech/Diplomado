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
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../design-system/tokens';
import { TTButton, TTInput, TTSelect } from '../design-system/components';

/**
 * FormModal - Modal de formulario dinámico TECTODE ERP
 * Mantiene la lógica de payload existente e integra la estética TECTODE.
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
    <View style={styles.linesContainer}>
      {rows.map((row, idx) => (
        <View key={`line-${idx}`} style={styles.lineRow}>
          {itemFields.map((it) => (
            <View key={it.name} style={styles.lineCell}>
              <Text style={styles.lineLabel}>{it.label}</Text>
              {it.type === 'select' ? (
                <TTSelect
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
                  placeholderTextColor={COLORS.textMuted}
                />
              )}
            </View>
          ))}
          <Pressable style={styles.lineRemove} onPress={() => onChange(rows.filter((_, i) => i !== idx))}>
            <Text style={styles.lineRemoveText}>✕</Text>
          </Pressable>
        </View>
      ))}

      <TTButton variant="secondary" size="sm" onPress={add} style={styles.lineAddBtn}>
        + Agregar línea
      </TTButton>
    </View>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <Pressable style={styles.checkRow} onPress={() => onChange(!checked)}>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.boxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function PermissionPicker({ groups, value, onChange }) {
  const toggle = (perm) => {
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm]);
  };

  const selectGroup = (items) => {
    onChange([...new Set([...value, ...items])]);
  };

  if (groups.length === 0) return <Text style={styles.hint}>Sin permisos disponibles.</Text>;

  return (
    <View style={styles.permContainer}>
      {groups.map((g) => (
        <View key={g.name} style={styles.permGroup}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{g.name}</Text>
            <Pressable style={styles.groupAllBtn} onPress={() => selectGroup(g.items)}>
              <Text style={styles.groupAllText}>Todos</Text>
            </Pressable>
          </View>

          <View style={styles.chips}>
            {g.items.map((perm) => {
              const on = value.includes(perm);
              return (
                <Pressable
                  key={perm}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggle(perm)}
                >
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

  if (!visible) return null;

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
                    {f.required ? <Text style={styles.req}> *</Text> : ''}
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
                    {f.required ? <Text style={styles.req}> *</Text> : ''}
                  </Text>
                  <LinesEditor
                    field={f}
                    rows={values[f.name] || []}
                    onChange={(v) => set(f.name, v)}
                  />
                </View>
              ) : f.type === 'select' ? (
                <TTSelect
                  key={f.name}
                  label={f.label}
                  value={values[f.name] || null}
                  onChange={(v) => set(f.name, v || '')}
                  options={f.options || []}
                  placeholder={f.placeholder || 'Seleccione…'}
                  style={styles.field}
                />
              ) : f.type === 'checkbox' ? (
                <View key={f.name} style={styles.field}>
                  <Checkbox
                    checked={Boolean(values[f.name])}
                    onChange={(v) => set(f.name, v)}
                    label={f.checkboxLabel || f.label}
                  />
                </View>
              ) : (
                <TTInput
                  key={f.name}
                  label={f.label}
                  required={f.required}
                  value={values[f.name] || ''}
                  onChangeText={(t) => set(f.name, t)}
                  keyboardType={f.type === 'number' ? 'numeric' : f.keyboardType || 'default'}
                  secureTextEntry={f.type === 'password'}
                  multiline={f.type === 'textarea'}
                  placeholder={f.type === 'date' ? 'AAAA-MM-DD' : f.placeholder || ''}
                  hint={f.hint}
                  style={styles.field}
                />
              )
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TTButton variant="secondary" size="md" onPress={onCancel} disabled={busy}>
              Cancelar
            </TTButton>
            <TTButton variant="primary" size="md" onPress={handleSave} loading={busy} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </TTButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  body: {
    gap: SPACING.md,
  },
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  req: {
    color: COLORS.error,
  },
  hint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  errorBox: {
    backgroundColor: `${COLORS.error}15`,
    borderColor: `${COLORS.error}40`,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },

  // Lines Editor
  linesContainer: {
    gap: SPACING.md,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexWrap: 'wrap',
  },
  lineCell: {
    flex: 1,
    minWidth: 110,
    gap: 2,
  },
  lineLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  lineInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
  },
  lineRemove: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.error}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineRemoveText: {
    color: COLORS.error,
    fontWeight: '700',
  },
  lineAddBtn: {
    alignSelf: 'flex-start',
  },

  // Checkbox
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.borderHover,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  boxOn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  boxMark: {
    color: COLORS.textDark,
    fontSize: 12,
    fontWeight: '800',
  },
  checkLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
  },

  // Permission Picker
  permContainer: {
    gap: SPACING.md,
  },
  permGroup: {
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  groupAllBtn: {
    backgroundColor: `${COLORS.primary}25`,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  groupAllText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 4,
  },
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.card,
  },
  chipOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  chipTextOn: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});
