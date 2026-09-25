import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTButton - Botón TECTODE ERP
 * Variantes: primary (Lime #B6FF00), brand (Morado #7C3AED), secondary (#151B28), ghost, danger (#EF4444)
 * Tamaños: sm, md, lg
 */
export function TTButton({
  children,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  iconLeft,
  iconRight,
  ...props
}) {
  const content = title || children;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ hovered, pressed }) => [
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        hovered && styles[`variant_${variant}_hover`],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'sm' ? 'small' : 'small'}
          color={variant === 'primary' ? COLORS.textDark : COLORS.textPrimary}
        />
      ) : (
        <>
          {iconLeft ? iconLeft : null}
          <Text
            style={[
              styles.text,
              styles[`textSize_${size}`],
              styles[`textVariant_${variant}`],
              disabled && styles.textDisabled,
              textStyle,
            ]}
          >
            {content}
          </Text>
          {iconRight ? iconRight : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  // Tamaños
  size_sm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    minHeight: 32,
  },
  size_md: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    minHeight: 40,
  },
  size_lg: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },

  // Variantes
  variant_primary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  variant_primary_hover: {
    backgroundColor: COLORS.accentHover,
    borderColor: COLORS.accentHover,
  },

  variant_brand: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  variant_brand_hover: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryLight,
  },

  variant_secondary: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.border,
  },
  variant_secondary_hover: {
    backgroundColor: COLORS.border,
    borderColor: COLORS.borderHover,
  },

  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  variant_ghost_hover: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  variant_danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: COLORS.error,
  },
  variant_danger_hover: {
    backgroundColor: COLORS.error,
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  disabled: {
    opacity: 0.4,
  },

  // Textos
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.ui,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  textSize_sm: { fontSize: TYPOGRAPHY.fontSize.sm },
  textSize_md: { fontSize: TYPOGRAPHY.fontSize.md },
  textSize_lg: { fontSize: TYPOGRAPHY.fontSize.lg },

  textVariant_primary: { color: COLORS.textDark, fontWeight: '700' },
  textVariant_brand: { color: COLORS.textPrimary },
  textVariant_secondary: { color: COLORS.textPrimary },
  textVariant_ghost: { color: COLORS.textSecondary },
  textVariant_danger: { color: COLORS.error },
  textDisabled: { color: COLORS.textMuted },
});
