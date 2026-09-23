import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { invert } from '../../lib/format';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS_CREATE = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

const STATUS_EDIT = [
  ...STATUS_CREATE,
  { value: 'locked', label: 'Bloqueado' },
];

/** Usuarios de la empresa: alta con contraseña fuerte, rol y sucursal. */
export default function UsersScreen() {
  const { can, session } = useAuth();
  const me = session?.user?._id;
  const roles = usePicklist('/roles', (r) => r.label || r.code || String(r._id));
  const branches = usePicklist('/branches', (r) => r.name || r.code || String(r._id));
  const list = useList('/users');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const roleLabels = invert(roles.options);

  const fields = useMemo(() => {
    const isEdit = Boolean(editing && editing._id);
    return [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'lastName', label: 'Apellidos' },
      { name: 'email', label: 'Correo', keyboardType: 'email-address', required: true },
      isEdit
        ? { name: 'password', label: 'Nueva contraseña (opcional)', type: 'password' }
        : { name: 'password', label: 'Contraseña', type: 'password', required: true, hint: 'Mínimo 8 caracteres con letras y números.' },
      { name: 'roleId', label: 'Rol', type: 'select', options: roles.options, required: true },
      { name: 'branchId', label: 'Sucursal', type: 'select', options: branches.options, placeholder: '(sin sucursal)' },
      { name: 'status', label: 'Estado', type: 'select', options: isEdit ? STATUS_EDIT : STATUS_CREATE, defaultValue: 'active' },
    ];
  }, [editing, roles.options, branches.options]);

  const submit = async (values) => {
    if (editing && editing._id) {
      // Sin contraseña vacía: el backend sólo la cambia si llega.
      if (!values.password) delete values.password;
      await api(`/users/${editing._id}`, { method: 'PATCH', body: values });
    } else {
      await api('/users', { method: 'POST', body: values });
    }
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Usuarios"
        subtitle={`${list.total} registros`}
        columns={[
          {
            key: 'name',
            label: 'Nombre',
            width: 190,
            render: (r) => <Text style={styles.td}>{`${r.name} ${r.lastName || ''}`.trim()}</Text>,
          },
          { key: 'email', label: 'Correo', width: 190 },
          { key: 'roleId', label: 'Rol', width: 140, render: (r) => <Text style={styles.td}>{roleLabels[String(r.roleId?._id ?? r.roleId)] || '—'}</Text> },
          { key: 'status', label: 'Estado', width: 110, render: (r) => <StatusBadge value={r.status} /> },
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
        onCreate={can('users.create') ? () => setEditing({}) : undefined}
        createLabel="Nuevo usuario"
        rowActions={(row) => {
          // Nadie se edita/borra a sí mismo (defensa en cliente; el server también lo bloquea).
          if (String(row._id) === String(me)) return [];
          const actions = [];
          if (can('users.update')) actions.push({ label: 'Editar', onPress: () => setEditing(row) });
          if (can('users.delete')) {
            actions.push({
              label: 'Eliminar',
              danger: true,
              onPress: () =>
                confirm(`¿Eliminar el usuario "${row.email}"?`, async () => {
                  await api(`/users/${row._id}`, { method: 'DELETE' });
                  list.reload();
                }),
            });
          }
          return actions;
        }}
        emptyText="Sin usuarios."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar usuario' : 'Nuevo usuario'}
        fields={fields}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' } };
