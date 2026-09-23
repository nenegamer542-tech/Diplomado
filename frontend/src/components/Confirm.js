import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Confirmación reutilizable (RN Web no implementa Alert.alert):
 *   const [confirmUI, confirm] = useConfirm();
 *   confirm('¿Aprobar orden?', async () => { ... });
 *   return <>{confirmUI} …</>
 * Si la acción rechaza (p.ej. 409/403 del backend), el mensaje canónico
 * se muestra en el mismo diálogo; la promesa nunca queda silenciada.
 */
export function useConfirm() {
  const [state, setState] = useState(null); // { message, action } | { error }

  const confirm = useCallback((message, action) => setState({ message, action }), []);

  const ui = (
    <ConfirmModal
      visible={Boolean(state)}
      message={state?.error || state?.message || ''}
      mode={state?.error ? 'error' : 'confirm'}
      onCancel={() => setState(null)}
      onConfirm={() => {
        const action = state?.action;
        setState(null);
        if (!action) return;
        Promise.resolve()
          .then(action)
          .catch((e) => setState({ error: e.message || 'Ocurrió un error. Intente de nuevo.' }));
      }}
    />
  );

  return [ui, confirm];
}

export function ConfirmModal({ visible, message, mode = 'confirm', onCancel, onConfirm }) {
  const isError = mode === 'error';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[styles.text, isError && styles.errorText]}>{message}</Text>
          <View style={styles.row}>
            {!isError ? (
              <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, isError ? styles.cancel : styles.ok]} onPress={onCancel}>
              <Text style={isError ? styles.cancelText : styles.okText}>{isError ? 'Entendido' : 'Confirmar'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0f172a66',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  text: { fontSize: 15, color: '#0f172a', lineHeight: 21 },
  errorText: { color: '#b91c1c', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  cancel: { backgroundColor: '#f1f5f9' },
  cancelText: { color: '#334155', fontWeight: '600' },
  ok: { backgroundColor: '#2563eb' },
  okText: { color: '#fff', fontWeight: '600' },
});
