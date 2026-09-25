import React, { useCallback, useState } from 'react';
import { TTConfirmModal } from '../design-system/components/TTConfirmModal';

/**
 * useConfirm - Hook de confirmación adaptable TECTODE ERP
 */
export function useConfirm() {
  const [state, setState] = useState(null);

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
    <TTConfirmModal
      visible={visible}
      message={message}
      isError={isError}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
