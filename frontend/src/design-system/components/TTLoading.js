import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTLoading - Loader / Spinner o Skeleton TECTODE
 */
export function TTLoading({ text = 'Cargando datos…', style }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.spinnerWrapper}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
}

/**
 * TTSkeleton - Fila cargadora esquelética
 */
export function TTSkeleton({ height = 20, width = '100%', style }) {
  return <View style={[styles.skeleton, { height, width }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  spinnerWrapper: {
    padding: SPACING.md,
    backgroundColor: `${COLORS.accent}12`,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: `${COLORS.accent}30`,
  },
  text: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  skeleton: {
    backgroundColor: COLORS.cardElevated,
    borderRadius: RADIUS.xs,
    opacity: 0.6,
  },
});
