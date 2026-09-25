import React, { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
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

/**
 * Roles: permisos desde el catálogo del backend (GET /roles/permissions),
 * agrupados por módulo. Los roles `isSystem` no se editan ni se borran.
 */
export default function RolesScreen() {
  const { can } = useAuth();
  const list = useList('/roles');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api('/roles/permissions')
      .then((d) => {
        if (cancelled) return;
        const p = d?.permissions ?? d;
        if (Array.isArray(p)) setGroups([{ name: 'Permisos', items: p }]);
        else if (p && typeof p === 'object') {
          setGroups(
            Object.entries(p)
              .map(([name, items]) => ({ name, items: Array.isArray(items) ? items : [] }))
              .filter((g) => g.items.length > 0)
          );
        }
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fields = useMemo(() => {
    const isEdit = Boolean(editing && editing._id);
    const base = [
      ...(isEdit ? [] : [{ name: 'code', label: 'Código', required: true, placeholder: 'mi_rol', hint: '3-40 caracteres: minúsculas, números y _.' }]),
      { name: 'label', label: 'Nombre visible', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'permissions', label: 'Permisos', type: 'permissions', groups },
      { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
    ];
    return base;
  }, [editing, groups]);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/roles/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/roles', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Roles y permisos"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 130 },
          { key: 'label', label: 'Nombre', width: 150 },
          { key: 'description', label: 'Descripción', width: 220 },
          {
            key: 'permissions',
            label: 'Permisos',
            width: 90,
            render: (r) => <Text style={styles.td}>{Array.isArray(r.permissions) ? r.permissions.length : 0}</Text>,
          },
          { key: 'isSystem', label: 'Origen', width: 90, render: (r) => <Text style={styles.td}>{r.isSystem ? 'Sistema' : 'Propio'}</Text> },
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
        onCreate={can('roles.create') ? () => setEditing({}) : undefined}
        createLabel="Nuevo rol"
        rowActions={(row) => {
          if (row.isSystem) return [];
          const actions = [];
          if (can('roles.update')) actions.push({ label: 'Editar', onPress: () => setEditing(row) });
          if (can('roles.delete')) {
            actions.push({
              label: 'Eliminar',
              danger: true,
              onPress: () =>
                confirm(`¿Eliminar el rol "${row.label}"?`, async () => {
                  await api(`/roles/${row._id}`, { method: 'DELETE' });
                  list.reload();
                }),
            });
          }
          return actions;
        }}
        emptyText="Sin roles."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar rol' : 'Nuevo rol'}
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
