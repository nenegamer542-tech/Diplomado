import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import { money } from '../../lib/format';
import { useList } from '../../hooks/useResource';

const currentYear = new Date().getFullYear();

const FIELDS = [
  { name: 'year', label: 'Año', type: 'number', required: true, defaultValue: currentYear },
  { name: 'month', label: 'Mes (1-12)', type: 'number', required: true },
  { name: 'category', label: 'Categoría', required: true },
  { name: 'plannedAmount', label: 'Importe planeado', type: 'number', required: true },
  { name: 'notes', label: 'Notas', type: 'textarea' },
];

/**
 * Presupuestos: clave única (empresa, año, mes, categoría) — un duplicado
 * devuelve el 409 canónico que el FormModal muestra tal cual.
 */
export default function BudgetsScreen() {
  const { can } = useAuth();
  const [year, setYear] = useState('');
  const query = useMemo(() => (year ? { year: Number(year) } : {}), [year]);
  const list = useList('/finance/budgets', query);
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/finance/budgets/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/finance/budgets', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Presupuestos"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'year', label: 'Año', width: 80 },
          { key: 'month', label: 'Mes', width: 70 },
          { key: 'category', label: 'Categoría', width: 180 },
          { key: 'plannedAmount', label: 'Planeado', width: 130, render: (r) => <Text style={styles.td}>{money(r.plannedAmount)}</Text> },
          { key: 'notes', label: 'Notas', width: 220 },
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
        onCreate={can('finance.budgets.create') ? () => setEditing({}) : undefined}
        createLabel="Nuevo presupuesto"
        rowActions={(row) => [
          ...(can('finance.budgets.update')
            ? [{ label: 'Editar', onPress: () => setEditing(row) }]
            : []),
          ...(can('finance.budgets.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar el presupuesto de ${row.category} (${row.month}/${row.year})?`, async () => {
                      await api(`/finance/budgets/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
        emptyText="Sin presupuestos."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        fields={FIELDS}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' } };
