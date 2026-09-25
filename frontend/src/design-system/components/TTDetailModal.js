import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';
import { TTButton } from './TTButton';
import { TTModal } from './TTModal';

/**
 * TTDetailModal - Modal de visualización de detalles de entidad TECTODE
 */
export function TTDetailModal({
  visible,
  title,
  subtitle,
  entries = [],
  columns,
  rows,
  raw,
  onClose,
  maxWidth = 640,
}) {
  return (
    <TTModal
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      maxWidth={maxWidth}
      footer={
        <TTButton variant="secondary" size="md" onPress={onClose}>
          Cerrar
        </TTButton>
      }
    >
      <View style={styles.container}>
        {/* Entradas Clave-Valor */}
        <View style={styles.grid}>
          {entries.map((entry, idx) => (
            <View key={`${entry.label}-${idx}`} style={styles.entry}>
              <Text style={styles.label}>{entry.label}</Text>
              <View style={styles.valueBox}>
                {typeof entry.value === 'string' || typeof entry.value === 'number' ? (
                  <Text style={styles.valueText}>{entry.value}</Text>
                ) : (
                  entry.value
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Tabla de Líneas / Detalle si aplica */}
        {rows && rows.length > 0 ? (
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={[styles.tr, styles.thead]}>
                  {(columns || []).map((col) => (
                    <Text key={col.key} style={[styles.th, { minWidth: col.width || 100 }]}>
                      {col.label}
                    </Text>
                  ))}
                </View>
                {rows.map((row, idx) => (
                  <View key={String(row._id ?? idx)} style={styles.tr}>
                    {(columns || []).map((col) => (
                      <View key={col.key} style={{ minWidth: col.width || 100, paddingVertical: SPACING.sm }}>
                        {col.render ? (
                          col.render(row)
                        ) : (
                          <Text style={styles.td}>{String(row[col.key] ?? '—')}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Bloque Raw / Auditoría */}
        {raw ? (
          <View style={styles.rawWrapper}>
            <Text style={styles.rawTitle}>Traza de Auditoría (JSON)</Text>
            <ScrollView style={styles.rawScroll} horizontal>
              <Text style={styles.rawText}>{raw}</Text>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </TTModal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },
  grid: {
    gap: SPACING.md,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    minWidth: 140,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  valueBox: {
    flex: 1,
    minWidth: 180,
  },
  valueText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },

  // Table
  tableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tr: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  thead: {
    backgroundColor: COLORS.card,
  },
  th: {
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  td: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
  },

  // Raw
  rawWrapper: {
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rawTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  rawScroll: {
    maxHeight: 180,
  },
  rawText: {
    fontFamily: TYPOGRAPHY.fontFamily.mono,
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    color: COLORS.textSecondary,
  },
});
