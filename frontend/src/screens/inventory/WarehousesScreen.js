import React, { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

/** CRUD de almacenes (sucursal opcional, marca de almacén por defecto). */
export default function WarehousesScreen() {
  const { can } = useAuth();
  const list = useList('/warehouses');
  const branches = usePicklist('/branches', (r) => r.name || r.code || String(r._id));
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const fields = [
    { name: 'code', label: 'Código', required: true, placeholder: 'ALM-01' },
    { name: 'name', label: 'Nombre', required: true },
    {
      name: 'branchId',
      label: 'Sucursal',
      type: 'select',
      options: branches.options,
      placeholder: '(sin sucursal)',
    },
    { name: 'address', label: 'Dirección' },
    { name: 'isDefault', label: 'Almacén por defecto', type: 'checkbox', checkboxLabel: 'Usar como almacén por defecto' },
    { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
  ];

  const submit = async (values) => {
    if (editing && editing._id) await api(`/warehouses/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/warehouses', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Almacenes"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 100 },
          { key: 'name', label: 'Nombre', width: 180 },
          { key: 'address', label: 'Dirección', width: 200 },
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
        onCreate={can('warehouses.create') ? () => setEditing({}) : undefined}
        rowActions={(row) => [
          ...(can('warehouses.update')
            ? [{ label: 'Editar', onPress: () => setEditing(row) }]
            : []),
          ...(can('warehouses.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar el almacén "${row.name}"?`, async () => {
                      await api(`/warehouses/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar almacén' : 'Nuevo almacén'}
        fields={fields}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#F8FAFC' } };
