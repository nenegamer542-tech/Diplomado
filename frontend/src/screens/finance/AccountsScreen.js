import React, { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { money } from '../../lib/format';
import { useList } from '../../hooks/useResource';

const TYPE_OPTIONS = [
  { value: 'bank', label: 'Banco' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'wallet', label: 'Billetera' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
];

const TYPE_LABEL = { bank: 'Banco', cash: 'Efectivo', wallet: 'Billetera' };

const FIELDS = [
  { name: 'code', label: 'Código', required: true, placeholder: 'CTA-01' },
  { name: 'name', label: 'Nombre', required: true },
  { name: 'type', label: 'Tipo', type: 'select', options: TYPE_OPTIONS, defaultValue: 'bank' },
  { name: 'currency', label: 'Moneda (ISO 3 letras)', placeholder: 'USD', defaultValue: 'USD' },
  { name: 'notes', label: 'Notas', type: 'textarea' },
  { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
];

/**
 * Cuentas: el saldo NUNCA se edita desde el cliente (lo gestiona el servidor
 * con incremento atómico, ADR-011). Las cuentas con movimientos no se borran.
 */
export default function AccountsScreen() {
  const { can } = useAuth();
  const list = useList('/finance/accounts');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/finance/accounts/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/finance/accounts', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Cuentas"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 100 },
          { key: 'name', label: 'Nombre', width: 190 },
          { key: 'type', label: 'Tipo', width: 100, render: (r) => <Text style={styles.td}>{TYPE_LABEL[r.type] || r.type}</Text> },
          { key: 'currency', label: 'Moneda', width: 80 },
          { key: 'balance', label: 'Saldo', width: 120, render: (r) => <Text style={styles.balance}>{money(r.balance)}</Text> },
          { key: 'status', label: 'Estado', width: 100, render: (r) => <StatusBadge value={r.status} /> },
        ]}
        rows={list.items}
        loading={list.loading}
        error={list.error}
        search={list.search}
        onSearchChange={list.setSearch}
        onRefresh={list.reload}
        page={list.page}
        total={list.total}
        limit={list.limit}
        onPageChange={list.setPage}
        onCreate={can('finance.accounts.create') ? () => setEditing({}) : undefined}
        rowActions={(row) => [
          ...(can('finance.accounts.update') ? [{ label: 'Editar', onPress: () => setEditing(row) }] : []),
          ...(can('finance.accounts.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar la cuenta "${row.name}"?`, async () => {
                      await api(`/finance/accounts/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar cuenta' : 'Nueva cuenta'}
        fields={FIELDS}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' }, balance: { fontSize: 14, fontWeight: '700', color: '#0f172a' } };
