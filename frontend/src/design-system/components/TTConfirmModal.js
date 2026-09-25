import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';
import { TTButton } from './TTButton';

/**
 * useTTConfirm - Hook de confirmación reutilizable
 */
export function useTTConfirm() {
  const [state, setState] = useState(null);

  const confirm = (message, action, title = 'Confirmar acción') => setState({ message, action, title });

  const ui = (
    <TTConfirmModal
      visible={Boolean(state)}
      title={state?.title}
      message={state?.error || state?.message || ''}
      isError={Boolean(state?.error)}
      onCancel={() => setState(null)}
      onConfirm={() => {
        const action = state?.action;
        setState(null);
        if (!action) return;
        Promise.resolve()
          .then(action)
          .catch((e) => setState({ error: e.message || 'Ocurrió un error inesperado.' }));
      }}
    />
  );

  return [ui, confirm];
}

export function TTConfirmModal({
  visible,
  title = 'Confirmar acción',
  message,
  isError = false,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onCancel,
  onConfirm,
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconWrapper, isError ? styles.iconError : styles.iconInfo]}>
              <Text style={styles.icon}>{isError ? '⚠️' : '❓'}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          <Text style={[styles.message, isError && styles.messageError]}>{message}</Text>

          <View style={styles.actions}>
            {!isError ? (
              <TTButton variant="secondary" size="md" onPress={onCancel}>
                {cancelLabel}
              </TTButton>
            ) : null}

            <TTButton
              variant={isError ? 'secondary' : 'primary'}
              size="md"
              onPress={isError ? onCancel : onConfirm}
            >
              {isError ? 'Entendido' : confirmLabel}
            </TTButton>
          </View>
        </View>
      </View>
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
    maxWidth: 440,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInfo: {
    backgroundColor: `${COLORS.accent}20`,
  },
  iconError: {
    backgroundColor: `${COLORS.error}20`,
  },
  icon: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  messageError: {
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
});
