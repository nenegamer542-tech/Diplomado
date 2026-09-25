import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTSelect - Desplegable selector TECTODE ERP
 */
export function TTSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccione una opción…',
  label,
  error,
  disabled = false,
  style,
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const searchable = options.length > 8;

  const visibleOptions = searchable
    ? options.filter((o) => String(o.label).toLowerCase().includes(filter.trim().toLowerCase()))
    : options;

  const handlePick = (val) => {
    onChange(val);
    setOpen(false);
    setFilter('');
  };

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        disabled={disabled}
        onPress={() => setOpen((o) => !o)}
        style={({ hovered }) => [
          styles.control,
          open && styles.controlOpen,
          error && styles.controlError,
          disabled && styles.controlDisabled,
          hovered && !disabled && styles.controlHovered,
        ]}
      >
        <Text style={[styles.valueText, !selectedOption && styles.placeholderText]} numberOfLines={1}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={styles.caret}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal o panel flotante */}
      {open ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={styles.panel} onStartShouldSetResponder={() => true}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>{label || 'Seleccionar'}</Text>
                <Pressable onPress={() => setOpen(false)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </Pressable>
              </View>

              {searchable ? (
                <View style={styles.filterWrapper}>
                  <TextInput
                    value={filter}
                    onChangeText={setFilter}
                    placeholder="Buscar opción…"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.filterInput}
                    autoFocus
                  />
                </View>
              ) : null}

              <FlatList
                keyboardShouldPersistTaps="handled"
                data={[{ value: '', label: placeholder }, ...visibleOptions]}
                keyExtractor={(item, idx) => `${String(item.value)}-${idx}`}
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = String(item.value) === String(value);
                  return (
                    <Pressable
                      style={({ hovered }) => [
                        styles.optionItem,
                        isSelected && styles.optionSelected,
                        hovered && styles.optionHovered,
                      ]}
                      onPress={() => handlePick(item.value === '' ? null : item.value)}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {item.label}
                      </Text>
                      {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs + 2,
    width: '100%',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 42,
  },
  controlOpen: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  controlError: {
    borderColor: COLORS.error,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  controlHovered: {
    borderColor: COLORS.borderHover,
  },
  valueText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  caret: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs + 2,
    marginLeft: SPACING.sm,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
  },

  // Modal Panel
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  panelTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  closeIcon: {
    color: COLORS.textMuted,
    fontSize: 16,
    padding: SPACING.xs,
  },
  filterWrapper: {
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  list: {
    maxHeight: 320,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionSelected: {
    backgroundColor: `${COLORS.primary}20`,
  },
  optionHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  optionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  optionTextSelected: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  checkMark: {
    color: COLORS.accent,
    fontWeight: '700',
  },
});
