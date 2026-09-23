import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import DetailModal from '../../components/DetailModal';
import Dropdown from '../../components/Dropdown';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { dateOf, invert, labelFor } from '../../lib/format';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'RELEASED', label: 'Liberada' },
  { value: 'DONE', label: 'Finalizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

/**
 * Órdenes de producción (ADR-013): sin DELETE.
 * DRAFT → RELEASED (sale material) → DONE (entra producto) | CANCELLED
 * (devuelve material; motivo obligatorio).
 */
export default function ProductionOrdersScreen() {
  const { can } = useAuth();
  const boms = usePicklist('/production/boms', (r) => r.code || String(r._id));
  const warehouses = usePicklist('/warehouses', (r) => r.name || r.code || String(r._id));
  const products = usePicklist('/products', (r) => r.name || r.sku || String(r._id));

  const [statusFilter, setStatusFilter] = useState('');
  const query = useMemo(() => (statusFilter ? { status: statusFilter } : {}), [statusFilter]);
  const list = useList('/production/orders', query);

  const [confirmUI, confirm] = useConfirm();
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit'|'cancel', row? }
  const [detail, setDetail] = useState(null);
  const [actionError, setActionError] = useState('');

  const productLabels = invert(products.options);

  const fields = useMemo(
    () => [
      { name: 'bomId', label: 'Lista de materiales', type: 'select', options: boms.options, required: true },
      { name: 'warehouseId', label: 'Almacén', type: 'select', options: warehouses.options, placeholder: '(por defecto)' },
      { name: 'quantity', label: 'Cantidad a producir', type: 'number', required: true },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    [boms.options, warehouses.options]
  );

  const submit = async (values) => {
    if (modal.mode === 'edit') await api(`/production/orders/${modal.row._id}`, { method: 'PATCH', body: values });
    else await api('/production/orders', { method: 'POST', body: values });
    setModal(null);
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

  const rowActions = (row) => {
    if (!can('production.update')) return [];
    const actions = [{ label: 'Ver', onPress: () => setDetail(row) }];
    if (row.status === 'DRAFT') {
      actions.push({ label: 'Editar', onPress: () => setModal({ mode: 'edit', row }) });
      actions.push({
        label: 'Liberar',
        onPress: () =>
          confirm(`¿Liberar la orden ${row.code || ''}? Se registrará la salida de material de las bodegas.`, () =>
            run(async () => {
              await api(`/production/orders/${row._id}/release`, { method: 'POST', body: {} });
              list.reload();
            })
          ),
      });
    }
    if (row.status === 'RELEASED') {
      actions.push({
        label: 'Finalizar',
        onPress: () =>
          confirm(`¿Finalizar la orden ${row.code || ''}? Se registrará la entrada del producto terminado.`, () =>
            run(async () => {
              await api(`/production/orders/${row._id}/done`, { method: 'POST', body: {} });
              list.reload();
            })
          ),
      });
      actions.push({ label: 'Cancelar', danger: true, onPress: () => setModal({ mode: 'cancel', row }) });
    }
    return actions;
  };

  const detailRow = detail;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ minWidth: 220, maxWidth: 300, gap: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>Estado</Text>
        <Dropdown
          value={statusFilter || null}
          onChange={(v) => setStatusFilter(v || '')}
          options={STATUS_OPTIONS}
          placeholder="(todas)"
        />
      </View>

      <DataTable
        title="Órdenes de producción"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 120 },
          { key: 'bomId', label: 'BOM', width: 130, render: (r) => <Text style={styles.td}>{labelFor(r.bomId, invert(boms.options))}</Text> },
          { key: 'quantity', label: 'Cantidad', width: 90 },
          { key: 'createdAt', label: 'Creada', width: 110, render: (r) => <Text style={styles.td}>{dateOf(r.createdAt)}</Text> },
          { key: 'status', label: 'Estado', width: 120, render: (r) => <StatusBadge value={r.status} /> },
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
        onCreate={can('production.create') ? () => setModal({ mode: 'create' }) : undefined}
        createLabel="Nueva orden"
        rowActions={rowActions}
        emptyText="Sin órdenes de producción."
      />

      <FormModal
        visible={Boolean(modal && (modal.mode === 'create' || modal.mode === 'edit'))}
        title={modal && modal.mode === 'edit' ? 'Editar orden de producción' : 'Nueva orden de producción'}
        fields={fields}
        initial={modal && modal.row}
        onSubmit={submit}
        onCancel={() => setModal(null)}
      />

      <FormModal
        visible={Boolean(modal && modal.mode === 'cancel')}
        title="Cancelar orden de producción"
        fields={[{ name: 'reason', label: 'Motivo de cancelación', type: 'textarea', required: true }]}
        initial={null}
        onSubmit={async (values) => {
          await run(async () => {
            await api(`/production/orders/${modal.row._id}/cancel`, { method: 'POST', body: values });
            list.reload();
          });
          setModal(null);
        }}
        onCancel={() => setModal(null)}
      />

      <DetailModal
        visible={Boolean(detailRow)}
        title={`Orden ${detailRow?.code || ''}`}
        entries={
          detailRow
            ? [
                { label: 'Código', value: <Text style={styles.td}>{detailRow.code || '—'}</Text> },
                { label: 'Estado', value: <StatusBadge value={detailRow.status} /> },
                { label: 'Cantidad', value: <Text style={styles.td}>{detailRow.quantity}</Text> },
                { label: 'Creada', value: <Text style={styles.td}>{dateOf(detailRow.createdAt, true)}</Text> },
                { label: 'Notas', value: <Text style={styles.td}>{detailRow.notes || '—'}</Text> },
                ...(detailRow.cancelReason
                  ? [{ label: 'Motivo de cancelación', value: <Text style={styles.td}>{detailRow.cancelReason}</Text> }]
                  : []),
              ]
            : []
        }
        onClose={() => setDetail(null)}
      />
      {confirmUI}
    </View>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' } };
