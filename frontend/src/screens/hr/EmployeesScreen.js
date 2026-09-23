import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { dateOf, money } from '../../lib/format';
import { useList } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo (baja)' },
];

/**
 * Empleados RRHH: sin DELETE; la baja es `status: inactive` (ADR-012).
 * `documentId` es único por empresa (409 con details.fields).
 */
export default function EmployeesScreen() {
  const { can } = useAuth();
  const list = useList('/hr/employees');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const fields = useMemo(
    () => [
      { name: 'documentId', label: 'Documento', required: true },
      { name: 'firstName', label: 'Nombre', required: true },
      { name: 'lastName', label: 'Apellido', required: true },
      { name: 'email', label: 'Correo', keyboardType: 'email-address' },
      { name: 'position', label: 'Puesto' },
      { name: 'department', label: 'Departamento' },
      { name: 'hireDate', label: 'Fecha de ingreso', type: 'date' },
      { name: 'salary', label: 'Salario', type: 'number' },
      { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
      { name: 'terminationDate', label: 'Fecha de baja', type: 'date' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    []
  );

  const submit = async (values) => {
    if (editing && editing._id) await api(`/hr/employees/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/hr/employees', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  const setStatus = (row, status, message) =>
    confirm(message, async () => {
      await api(`/hr/employees/${row._id}`, { method: 'PATCH', body: { status } });
      list.reload();
    });

  return (
    <>
      <DataTable
        title="Empleados"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'documentId', label: 'Documento', width: 110 },
          {
            key: 'firstName',
            label: 'Nombre completo',
            width: 190,
            render: (r) => <Text style={styles.td}>{`${r.firstName} ${r.lastName}`}</Text>,
          },
          { key: 'position', label: 'Puesto', width: 140 },
          { key: 'department', label: 'Departamento', width: 130 },
          { key: 'hireDate', label: 'Ingreso', width: 110, render: (r) => <Text style={styles.td}>{dateOf(r.hireDate)}</Text> },
          { key: 'salary', label: 'Salario', width: 110, render: (r) => <Text style={styles.td}>{money(r.salary)}</Text> },
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
        onCreate={can('hr.create') ? () => setEditing({}) : undefined}
        createLabel="Nuevo empleado"
        rowActions={(row) => {
          if (!can('hr.update')) return [];
          const actions = [{ label: 'Editar', onPress: () => setEditing(row) }];
          if (row.status === 'active') {
            actions.push({
              label: 'Dar de baja',
              danger: true,
              onPress: () =>
                setStatus(row, 'inactive', `¿Dar de baja al empleado "${row.firstName} ${row.lastName}"?`),
            });
          } else {
            actions.push({ label: 'Reactivar', onPress: () => setStatus(row, 'active', `¿Reactivar al empleado "${row.firstName} ${row.lastName}"?`) });
          }
          return actions;
        }}
        emptyText="Sin empleados."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar empleado' : 'Nuevo empleado'}
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
