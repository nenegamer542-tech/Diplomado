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
  { name: 'code', label: 'Código', required: true, placeholder: 'PROV-01' },
  { name: 'name', label: 'Razón social / nombre', required: true },
  { name: 'contactName', label: 'Persona de contacto' },
  { name: 'email', label: 'Correo', keyboardType: 'email-address' },
  { name: 'phone', label: 'Teléfono' },
  { name: 'address', label: 'Dirección' },
  { name: 'notes', label: 'Notas', type: 'textarea' },
  { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
];

/** CRUD de proveedores. */
export default function SuppliersScreen() {
  const { can } = useAuth();
  const list = useList('/suppliers');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/suppliers/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/suppliers', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Proveedores"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 100 },
          { key: 'name', label: 'Nombre', width: 220 },
          { key: 'contactName', label: 'Contacto', width: 160 },
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
        onCreate={can('suppliers.create') ? () => setEditing({}) : undefined}
        rowActions={(row) => [
          ...(can('suppliers.update') ? [{ label: 'Editar', onPress: () => setEditing(row) }] : []),
          ...(can('suppliers.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar el proveedor "${row.name}"?`, async () => {
                      await api(`/suppliers/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar proveedor' : 'Nuevo proveedor'}
        fields={FIELDS}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}
