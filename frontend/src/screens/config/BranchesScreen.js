import React, { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { useList } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
];

const FIELDS = [
  { name: 'code', label: 'Código', required: true, placeholder: 'SUC-01' },
  { name: 'name', label: 'Nombre', required: true },
  { name: 'address', label: 'Dirección' },
  { name: 'phone', label: 'Teléfono' },
  { name: 'isDefault', label: 'Sucursal por defecto', type: 'checkbox', checkboxLabel: 'Usar como sucursal por defecto' },
  { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
];

/** CRUD de sucursales. */
export default function BranchesScreen() {
  const { can } = useAuth();
  const list = useList('/branches');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/branches/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/branches', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Sucursales"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 100 },
          { key: 'name', label: 'Nombre', width: 180 },
          { key: 'address', label: 'Dirección', width: 200 },
          { key: 'phone', label: 'Teléfono', width: 130 },
          { key: 'isDefault', label: 'Por defecto', width: 100, render: (r) => <Text style={styles.td}>{r.isDefault ? 'Sí' : 'No'}</Text> },
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
        onCreate={can('branches.create') ? () => setEditing({}) : undefined}
        createLabel="Nueva sucursal"
        rowActions={(row) => [
          ...(can('branches.update') ? [{ label: 'Editar', onPress: () => setEditing(row) }] : []),
          ...(can('branches.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar la sucursal "${row.name}"?`, async () => {
                      await api(`/branches/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
        emptyText="Sin sucursales."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar sucursal' : 'Nueva sucursal'}
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
