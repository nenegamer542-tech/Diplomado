import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import Dropdown from '../../components/Dropdown';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { money } from '../../lib/format';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS_LABEL = { NEW: 'Nuevo', CONTACTED: 'Contactado', QUALIFIED: 'Calificado', WON: 'Ganado', LOST: 'Perdido' };
const TERMINAL = ['WON', 'LOST'];
// Transición lineal permitida (ADR-012): NEW → CONTACTED → QUALIFIED → WON | LOST
const NEXT = { NEW: 'CONTACTED', CONTACTED: 'QUALIFIED' };
const NEXT_LABEL = { NEW: 'Marcar contactado', CONTACTED: 'Calificar' };

const SOURCE_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'referral', label: 'Referido' },
  { value: 'call', label: 'Llamada' },
  { value: 'event', label: 'Evento' },
  { value: 'other', label: 'Otro' },
];

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** Leads CRM: sin DELETE; baja = estado terminal WON/LOST (409 si edita). */
export default function LeadsScreen() {
  const { can } = useAuth();
  const users = usePicklist('/users', (r) => `${r.name || ''} ${r.lastName || ''}`.trim() || r.email || String(r._id));

  const [statusFilter, setStatusFilter] = useState('');
  const query = useMemo(() => (statusFilter ? { status: statusFilter } : {}), [statusFilter]);
  const list = useList('/crm/leads', query);
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const fields = useMemo(() => {
    const base = [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'company', label: 'Empresa' },
      { name: 'email', label: 'Correo', keyboardType: 'email-address' },
      { name: 'phone', label: 'Teléfono' },
      { name: 'source', label: 'Origen', type: 'select', options: SOURCE_OPTIONS, defaultValue: 'web' },
      { name: 'expectedAmount', label: 'Importe previsto', type: 'number' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ];
    if (can('users.read')) base.push({ name: 'assignedTo', label: 'Asignado a', type: 'select', options: users.options, placeholder: '(sin asignar)' });
    // El estado sólo se elige al CREAR; después cambia por transiciones.
    if (!editing || !editing._id) base.push({ name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'NEW' });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, users.options]);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/crm/leads/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/crm/leads', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  const transition = (row, status) =>
    confirm(`¿Pasar "${row.name}" a ${STATUS_LABEL[status]}?`, async () => {
      await api(`/crm/leads/${row._id}`, { method: 'PATCH', body: { status } });
      list.reload();
    });

  const rowActions = (row) => {
    if (TERMINAL.includes(row.status) || !can('crm.update')) return [];
    const actions = [{ label: 'Editar', onPress: () => setEditing(row) }];
    if (NEXT[row.status]) actions.push({ label: NEXT_LABEL[row.status], onPress: () => transition(row, NEXT[row.status]) });
    if (row.status === 'QUALIFIED') {
      actions.push({ label: 'Ganado', onPress: () => transition(row, 'WON') });
      actions.push({ label: 'Perdido', danger: true, onPress: () => transition(row, 'LOST') });
    }
    return actions;
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
        title="Leads"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'name', label: 'Nombre', width: 170 },
          { key: 'company', label: 'Empresa', width: 150 },
          { key: 'source', label: 'Origen', width: 100, render: (r) => <Text style={styles.td}>{SOURCE_OPTIONS.find((s) => s.value === r.source)?.label || '—'}</Text> },
          { key: 'expectedAmount', label: 'Previsto', width: 110, render: (r) => <Text style={styles.td}>{money(r.expectedAmount)}</Text> },
          { key: 'status', label: 'Estado', width: 130, render: (r) => <StatusBadge value={r.status} /> },
          { key: 'notes', label: 'Notas', width: 200 },
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
        onCreate={can('crm.create') ? () => setEditing({}) : undefined}
        createLabel="Nuevo lead"
        rowActions={rowActions}
        emptyText="Sin leads."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar lead' : 'Nuevo lead'}
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
