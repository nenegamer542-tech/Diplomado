import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTTabs - Selector de pestañas TECTODE ERP
 */
export function TTTabs({ tabs = [], activeTab, onChangeTab, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.wrapper, style]}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChangeTab(tab.key)}
              style={({ hovered }) => [
                styles.tab,
                isActive && styles.activeTab,
                hovered && !isActive && styles.hoveredTab,
              ]}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
              </Text>

              {tab.badge !== undefined ? (
                <View style={[styles.badge, isActive && styles.activeBadge]}>
                  <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                    {tab.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxHeight: 44,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
  },
  activeTab: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
  },
  hoveredTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  badge: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
  },
  activeBadge: {
    backgroundColor: `${COLORS.accent}20`,
  },
  badgeText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  activeBadgeText: {
    color: COLORS.accent,
  },
});
