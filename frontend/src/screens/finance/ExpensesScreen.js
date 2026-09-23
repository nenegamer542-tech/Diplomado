import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import DataTable from '../../components/DataTable';
import Dropdown from '../../components/Dropdown';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { dateOf, invert, labelFor, money } from '../../lib/format';
import { useList, usePicklist } from '../../hooks/useResource';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Otro' },
];

const METHOD_LABEL = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', check: 'Cheque', other: 'Otro' };

const STATUS_OPTIONS = [
  { value: 'POSTED', label: 'Registrado' },
  { value: 'VOID', label: 'Anulado' },
];

/**
 * Gastos APPEND-ONLY (ADR-011): crear, leer y anular con motivo;
 * sin edición ni borrado. Al crear, el servidor descuenta la cuenta
 * respetando el invariante saldo >= 0.
 */
export default function ExpensesScreen() {
  const { can } = useAuth();
  const accounts = usePicklist('/finance/accounts', (r) => r.name || r.code || String(r._id));
  const suppliers = usePicklist('/suppliers', (r) => r.name || r.code || String(r._id));

  const [statusFilter, setStatusFilter] = useState('');
  const query = useMemo(() => (statusFilter ? { status: statusFilter } : {}), [statusFilter]);
  const list = useList('/finance/expenses', query);

  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [actionError, setActionError] = useState('');

  const accountLabels = invert(accounts.options);

  const fields = useMemo(
    () => [
      { name: 'amount', label: 'Importe', type: 'number', required: true },
      { name: 'date', label: 'Fecha', type: 'date', hint: 'Formato AAAA-MM-DD (hoy si se omite).' },
      { name: 'category', label: 'Categoría', required: true, placeholder: 'Alquiler, Suministros…' },
      { name: 'method', label: 'Método', type: 'select', options: METHOD_OPTIONS, defaultValue: 'cash' },
      { name: 'accountId', label: 'Cuenta', type: 'select', options: accounts.options, required: true },
      { name: 'supplierId', label: 'Proveedor', type: 'select', options: suppliers.options, placeholder: '(opcional)' },
      { name: 'reference', label: 'Referencia' },
      { name: 'description', label: 'Descripción', type: 'textarea' },
    ],
    [accounts.options, suppliers.options]
  );

  const submit = async (values) => {
    await api('/finance/expenses', { method: 'POST', body: values });
    setCreating(false);
    list.reload();
  };

  const run = async (fn) => {
    setActionError('');
    try {
      await fn();
    } catch (e) {
      setActionError(e.message);
    }
  };

  return (
    <>
      <View>
        <Dropdown
          value={statusFilter || null}
          onChange={(v) => setStatusFilter(v || '')}
          options={STATUS_OPTIONS}
          placeholder="(todos los estados)"
        />
      </View>

      <DataTable
        title="Gastos"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'date', label: 'Fecha', width: 110, render: (r) => <Text style={styles.td}>{dateOf(r.date || r.createdAt)}</Text> },
          { key: 'category', label: 'Categoría', width: 140 },
          { key: 'amount', label: 'Importe', width: 110, render: (r) => <Text style={styles.amount}>{money(r.amount)}</Text> },
          { key: 'method', label: 'Método', width: 120, render: (r) => <Text style={styles.td}>{METHOD_LABEL[r.method] || r.method}</Text> },
          { key: 'accountId', label: 'Cuenta', width: 150, render: (r) => <Text style={styles.td}>{labelFor(r.accountId, accountLabels)}</Text> },
          { key: 'status', label: 'Estado', width: 110, render: (r) => <StatusBadge value={r.status} /> },
        ]}
        rows={list.items}
        loading={list.loading}
        error={list.error || actionError}
        search={list.search}
        onSearchChange={list.setSearch}
        onRefresh={list.reload}
        page={list.page}
        total={list.total}
        limit={list.limit}
        onPageChange={list.setPage}
        onCreate={can('finance.expenses.create') ? () => setCreating(true) : undefined}
        createLabel="Nuevo gasto"
        rowActions={(row) =>
          row.status === 'POSTED' && can('finance.expenses.void')
            ? [{ label: 'Anular', danger: true, onPress: () => setVoiding(row) }]
            : []
        }
        emptyText="Sin gastos registrados."
      />

      <FormModal
        visible={creating}
        title="Nuevo gasto"
        fields={fields}
        initial={null}
        onSubmit={submit}
        onCancel={() => setCreating(false)}
      />

      <FormModal
        visible={Boolean(voiding)}
        title="Anular gasto"
        fields={[{ name: 'reason', label: 'Motivo de anulación', type: 'textarea', required: true }]}
        initial={null}
        onSubmit={async (values) => {
          await run(async () => {
            await api(`/finance/expenses/${voiding._id}/void`, { method: 'POST', body: values });
            setVoiding(null);
            list.reload();
          });
          setVoiding(null);
        }}
        onCancel={() => setVoiding(null)}
      />
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' }, amount: { fontSize: 14, fontWeight: '700', color: '#b91c1c' } };
