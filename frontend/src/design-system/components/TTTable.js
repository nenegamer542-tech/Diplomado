import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';
import { TTButton } from './TTButton';
import { TTEmptyState } from './TTEmptyState';
import { TTLoading } from './TTLoading';
import { TTSearch } from './TTSearch';

/**
 * TTTable - Tabla de datos empresarial TECTODE ERP
 */
export function TTTable({
  title,
  subtitle,
  columns = [],
  rows = [],
  loading = false,
  error = null,
  search = '',
  onSearchChange,
  onRefresh,
  page = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onCreate,
  createLabel = 'Nuevo',
  rowActions,
  emptyText = 'No hay datos registrados en este módulo.',
  emptyIcon = '📊',
}) {
  const [searchDraft, setSearchDraft] = useState(search);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const handleSearchSubmit = (val) => {
    setSearchDraft(val);
    if (onSearchChange) onSearchChange(val);
  };

  return (
    <View style={styles.container}>
      {/* Header Superior */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.headerActions}>
          {onSearchChange ? (
            <TTSearch
              value={searchDraft}
              onChangeText={handleSearchSubmit}
              placeholder="Buscar registros…"
            />
          ) : null}

          {onRefresh ? (
            <TTButton variant="secondary" size="md" onPress={onRefresh}>
              ↻
            </TTButton>
          ) : null}

          {onCreate ? (
            <TTButton variant="primary" size="md" onPress={onCreate}>
              + {createLabel}
            </TTButton>
          ) : null}
        </View>
      </View>

      {/* Banner de Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Contenedor de Tabla */}
      <View style={styles.tableCard}>
        <ScrollView horizontal contentContainerStyle={styles.tableScroll}>
          <View>
            {/* Cabecera de Tabla */}
            <View style={[styles.row, styles.headRow]}>
              {columns.map((col) => (
                <Text
                  key={col.key}
                  style={[styles.th, { minWidth: col.width || 130 }]}
                >
                  {col.label}
                </Text>
              ))}
              {rowActions ? <Text style={[styles.th, styles.thActions]}>Acciones</Text> : null}
            </View>

            {/* Cuerpo de Tabla */}
            {loading ? (
              <TTLoading text="Cargando información..." />
            ) : rows.length === 0 ? (
              <TTEmptyState
                icon={emptyIcon}
                title="Sin datos disponibles"
                description={error ? error : emptyText}
                actionLabel={onCreate ? createLabel : undefined}
                onAction={onCreate}
              />
            ) : (
              rows.map((row, idx) => (
                <View
                  key={String(row._id || idx)}
                  style={[styles.row, idx % 2 === 1 && styles.rowAlternate]}
                >
                  {columns.map((col) => (
                    <View
                      key={col.key}
                      style={{ minWidth: col.width || 130, paddingVertical: SPACING.md, paddingRight: SPACING.sm }}
                    >
                      {col.render ? (
                        col.render(row)
                      ) : (
                        <Text style={styles.td}>{formatCell(row[col.key])}</Text>
                      )}
                    </View>
                  ))}

                  {rowActions ? (
                    <View style={styles.actionsCell}>
                      {rowActions(row).map((action) => (
                        <Pressable
                          key={action.label}
                          onPress={action.onPress}
                          style={({ hovered }) => [
                            styles.actionBtn,
                            action.danger && styles.actionDanger,
                            hovered && (action.danger ? styles.actionDangerHover : styles.actionBtnHover),
                          ]}
                        >
                          <Text
                            style={[
                              styles.actionText,
                              action.danger && styles.actionDangerText,
                            ]}
                          >
                            {action.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* Paginación en Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Mostrando <Text style={styles.footerHighlight}>{from}–{to}</Text> de{' '}
          <Text style={styles.footerHighlight}>{total}</Text> registros · Página{' '}
          <Text style={styles.footerHighlight}>{page}</Text> de {totalPages}
        </Text>

        {onPageChange ? (
          <View style={styles.pager}>
            <Pressable
              disabled={page <= 1}
              onPress={() => onPageChange(page - 1)}
              style={({ hovered }) => [
                styles.pageBtn,
                page <= 1 && styles.pageDisabled,
                hovered && page > 1 && styles.pageHovered,
              ]}
            >
              <Text style={styles.pageBtnText}>‹ Prev</Text>
            </Pressable>

            <Pressable
              disabled={page >= totalPages}
              onPress={() => onPageChange(page + 1)}
              style={({ hovered }) => [
                styles.pageBtn,
                page >= totalPages && styles.pageDisabled,
                hovered && page < totalPages && styles.pageHovered,
              ]}
            >
              <Text style={styles.pageBtnText}>Sig ›</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatCell(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'object') return val.name || val.code || val.sku || val._id || '—';
  return String(val);
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  headerTitleGroup: {
    gap: SPACING.xs / 2,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  errorBox: {
    backgroundColor: `${COLORS.error}15`,
    borderColor: `${COLORS.error}40`,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Table Structure
  tableCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableScroll: {
    minWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headRow: {
    backgroundColor: COLORS.surface,
  },
  rowAlternate: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  th: {
    paddingVertical: SPACING.md,
    paddingRight: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  thActions: {
    minWidth: 160,
  },
  td: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },

  // Actions Column
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    paddingVertical: SPACING.sm,
    minWidth: 160,
    flexWrap: 'wrap',
  },
  actionBtn: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: SPACING.xs + 1,
  },
  actionBtnHover: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}20`,
  },
  actionText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  actionDanger: {
    backgroundColor: `${COLORS.error}15`,
    borderColor: `${COLORS.error}30`,
  },
  actionDangerHover: {
    backgroundColor: COLORS.error,
  },
  actionDangerText: {
    color: COLORS.error,
  },

  // Footer Pager
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  footerHighlight: {
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  pager: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  pageBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  pageHovered: {
    borderColor: COLORS.borderHover,
    backgroundColor: COLORS.cardElevated,
  },
  pageDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
