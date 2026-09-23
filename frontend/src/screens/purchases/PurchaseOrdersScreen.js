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
import { dateOf, invert, labelFor, money } from '../../lib/format';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'APPROVED', label: 'Aprobada' },
  { value: 'REJECTED', label: 'Rechazada' },
];

/**
 * Órdenes de compra (ADR-010): sólo lectura/creación/edición en DRAFT y
 * aprobación/rechazo; SIN DELETE. Aprobar genera la entrada de inventario.
 */
export default function PurchaseOrdersScreen() {
  const { can } = useAuth();
  const suppliers = usePicklist('/suppliers', (r) => r.name || r.code || String(r._id));
  const warehouses = usePicklist('/warehouses', (r) => r.name || r.code || String(r._id));
  const products = usePicklist('/products', (r) => r.name || r.sku || String(r._id));

  const [statusFilter, setStatusFilter] = useState('');
  const query = useMemo(() => (statusFilter ? { status: statusFilter } : {}), [statusFilter]);
  const list = useList('/purchase-orders', query);

  const [confirmUI, confirm] = useConfirm();
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit'|'reject', row? }
  const [detail, setDetail] = useState(null);
  const [actionError, setActionError] = useState('');

  const supplierLabels = invert(suppliers.options);
  const warehouseLabels = invert(warehouses.options);
  const productLabels = invert(products.options);

  const fields = useMemo(
    () => [
      { name: 'supplierId', label: 'Proveedor', type: 'select', options: suppliers.options, required: true },
      { name: 'warehouseId', label: 'Almacén', type: 'select', options: warehouses.options, placeholder: '(por defecto)' },
      {
        name: 'lines',
        label: 'Líneas',
        type: 'lines',
        required: true,
        itemFields: [
          { name: 'productId', label: 'Producto', type: 'select', options: products.options, required: true },
          { name: 'quantity', label: 'Cantidad', type: 'number', required: true },
          { name: 'unitCost', label: 'Costo unit.', type: 'number', required: true },
        ],
      },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    [suppliers.options, warehouses.options, products.options]
  );

  const submit = async (values) => {
    if (modal.mode === 'edit') await api(`/purchase-orders/${modal.row._id}`, { method: 'PATCH', body: values });
    else await api('/purchase-orders', { method: 'POST', body: values });
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

  const approve = (row) =>
    confirm(`¿Aprobar la orden ${row.code || ''}? Se registrará la entrada en inventario.`, () =>
      run(async () => {
        await api(`/purchase-orders/${row._id}/approve`, { method: 'POST', body: {} });
        list.reload();
      })
    );

  const columns = [
    { key: 'code', label: 'Folio', width: 110 },
    { key: 'supplierId', label: 'Proveedor', width: 180, render: (r) => <Text style={styles.td}>{labelFor(r.supplierId, supplierLabels)}</Text> },
    { key: 'total', label: 'Total', width: 100, render: (r) => <Text style={styles.td}>{money(r.total)}</Text> },
    { key: 'lines', label: 'Líneas', width: 70, render: (r) => <Text style={styles.td}>{Array.isArray(r.lines) ? r.lines.length : 0}</Text> },
    { key: 'createdAt', label: 'Creada', width: 110, render: (r) => <Text style={styles.td}>{dateOf(r.createdAt)}</Text> },
    { key: 'status', label: 'Estado', width: 110, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const rowActions = (row) => {
    const actions = [{ label: 'Ver detalle', onPress: () => setDetail(row) }];
    if (row.status === 'DRAFT') {
      if (can('purchases.update')) actions.push({ label: 'Editar', onPress: () => setModal({ mode: 'edit', row }) });
      if (can('purchases.approve')) {
        actions.push({ label: 'Aprobar', onPress: () => approve(row) });
        actions.push({ label: 'Rechazar', danger: true, onPress: () => setModal({ mode: 'reject', row }) });
      }
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
        title="Órdenes de compra"
        subtitle={`${list.total} registros`}
        columns={columns}
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
        onCreate={can('purchases.create') ? () => setModal({ mode: 'create' }) : undefined}
        createLabel="Nueva orden"
        rowActions={rowActions}
        emptyText="Sin órdenes de compra."
      />

      <FormModal
        visible={Boolean(modal && (modal.mode === 'create' || modal.mode === 'edit'))}
        title={modal && modal.mode === 'edit' ? 'Editar orden de compra' : 'Nueva orden de compra'}
        fields={fields}
        initial={modal && modal.row}
        onSubmit={submit}
        onCancel={() => setModal(null)}
      />

      <FormModal
        visible={Boolean(modal && modal.mode === 'reject')}
        title="Rechazar orden de compra"
        fields={[{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }]}
        initial={null}
        onSubmit={async (values) => {
          await api(`/purchase-orders/${modal.row._id}/reject`, { method: 'POST', body: values });
          setModal(null);
          list.reload();
        }}
        onCancel={() => setModal(null)}
      />

      <DetailModal
        visible={Boolean(detailRow)}
        title={`Orden ${detailRow?.code || ''}`}
        entries={
          detailRow
            ? [
                { label: 'Folio', value: <Text style={styles.td}>{detailRow.code || '—'}</Text> },
                { label: 'Proveedor', value: <Text style={styles.td}>{labelFor(detailRow.supplierId, supplierLabels)}</Text> },
                { label: 'Almacén', value: <Text style={styles.td}>{labelFor(detailRow.warehouseId, warehouseLabels)}</Text> },
                { label: 'Total', value: <Text style={styles.td}>{money(detailRow.total)}</Text> },
                { label: 'Estado', value: <StatusBadge value={detailRow.status} /> },
                { label: 'Creada', value: <Text style={styles.td}>{dateOf(detailRow.createdAt, true)}</Text> },
                { label: 'Notas', value: <Text style={styles.td}>{detailRow.notes || '—'}</Text> },
                ...(detailRow.rejectReason
                  ? [{ label: 'Motivo de rechazo', value: <Text style={styles.td}>{detailRow.rejectReason}</Text> }]
                  : []),
              ]
            : []
        }
        columns={[
          { key: 'productId', label: 'Producto', width: 200, render: (r) => <Text style={styles.td}>{labelFor(r.productId, productLabels)}</Text> },
          { key: 'quantity', label: 'Cant.', width: 70 },
          { key: 'unitCost', label: 'Costo unit.', width: 100, render: (r) => <Text style={styles.td}>{money(r.unitCost)}</Text> },
          {
            key: 'subtotal',
            label: 'Subtotal',
            width: 100,
            render: (r) => <Text style={styles.td}>{money(Number(r.quantity) * Number(r.unitCost))}</Text>,
          },
        ]}
        rows={detailRow && Array.isArray(detailRow.lines) ? detailRow.lines : []}
        onClose={() => setDetail(null)}
      />

      {confirmUI}
    </View>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' } };
