import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTCard - Contenedor en tarjeta TECTODE
 */
export function TTCard({ children, title, subtitle, action, elevated = false, style, contentStyle, onPress }) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={({ hovered }) => [
        styles.card,
        elevated && styles.elevated,
        hovered && onPress && styles.hovered,
        style,
      ]}
    >
      {title || subtitle || action ? (
        <View style={styles.header}>
          <View style={styles.titleArea}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Container>
  );
}

/**
 * TTStatCard - Tarjeta KPI empresarial TECTODE
 */
export function TTStatCard({ label, value, trend, trendType = 'neutral', icon, accentColor = COLORS.info, style }) {
  const isPositive = trendType === 'positive';
  const isNegative = trendType === 'negative';

  return (
    <View style={[styles.statCard, style]}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
      </View>

      <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>{value}</Text>

      {trend ? (
        <View style={styles.trendRow}>
          <Text
            style={[
              styles.trendText,
              isPositive && styles.trendPositive,
              isNegative && styles.trendNegative,
            ]}
          >
            {isPositive ? '↑ ' : isNegative ? '↓ ' : ''}
            {trend}
          </Text>
        </View>
      ) : null}

      <View style={[styles.topBorderGlow, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: COLORS.cardElevated,
  },
  hovered: {
    borderColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  titleArea: {
    flex: 1,
    gap: SPACING.xs / 2,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    gap: SPACING.md,
  },

  // Stat Card
  statCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    minWidth: 170,
    flex: 1,
    gap: SPACING.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statIcon: {
    fontSize: 16,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    marginVertical: SPACING.xs / 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
  },
  trendPositive: {
    color: COLORS.accent,
  },
  trendNegative: {
    color: COLORS.error,
  },
  topBorderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
});
