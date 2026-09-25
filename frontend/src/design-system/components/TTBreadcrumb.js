import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTBreadcrumb - Migas de pan navegables para TECTODE Header
 */
export function TTBreadcrumb({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 ? <Text style={styles.separator}>/</Text> : null}
            {isLast || !item.onPress ? (
              <Text style={[styles.item, isLast && styles.activeItem]}>
                {item.label}
              </Text>
            ) : (
              <Pressable onPress={item.onPress}>
                <Text style={[styles.item, styles.linkItem]}>{item.label}</Text>
              </Pressable>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    flexWrap: 'wrap',
  },
  separator: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  item: {
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  linkItem: {
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activeItem: {
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
