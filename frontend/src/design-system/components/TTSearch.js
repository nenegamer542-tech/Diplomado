import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTSearch - Campo de búsqueda rápido TECTODE ERP
 */
export function TTSearch({ value, onChangeText, onClear, placeholder = 'Buscar en Tec[ode…', style }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, focused && styles.focused, style]}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
      {value ? (
        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            if (onChangeText) onChangeText('');
            if (onClear) onClear();
          }}
        >
          <Text style={styles.clearIcon}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 38,
    minWidth: 220,
  },
  focused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: SPACING.xs + 2,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: SPACING.xs,
  },
  clearIcon: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
