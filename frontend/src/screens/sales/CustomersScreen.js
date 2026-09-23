import React, { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { useList } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

const FIELDS = [
  { name: 'code', label: 'Código', required: true, placeholder: 'CLI-01' },
  { name: 'name', label: 'Nombre', required: true },
  { name: 'taxId', label: 'NIF/CIF' },
  { name: 'email', label: 'Correo', keyboardType: 'email-address' },
  { name: 'phone', label: 'Teléfono' },
  { name: 'notes', label: 'Notas', type: 'textarea' },
  { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
];

/** CRUD de clientes. */
export default function CustomersScreen() {
  const { can } = useAuth();
  const list = useList('/customers');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/customers/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/customers', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Clientes"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 100 },
          { key: 'name', label: 'Nombre', width: 220 },
          { key: 'taxId', label: 'NIF/CIF', width: 120 },
          { key: 'email', label: 'Correo', width: 180 },
          { key: 'phone', label: 'Teléfono', width: 130 },
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
        onCreate={can('customers.create') ? () => setEditing({}) : undefined}
        rowActions={(row) => [
          ...(can('customers.update') ? [{ label: 'Editar', onPress: () => setEditing(row) }] : []),
          ...(can('customers.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar el cliente "${row.name}"?`, async () => {
                      await api(`/customers/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar cliente' : 'Nuevo cliente'}
        fields={FIELDS}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}
