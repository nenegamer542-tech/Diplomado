import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import DataTable from '../../components/DataTable';
import Dropdown from '../../components/Dropdown';
import FormModal from '../../components/FormModal';
import { useList, usePicklist } from '../../hooks/useResource';

const TYPE_OPTIONS = [
  { value: 'ENTRY', label: 'Entrada' },
  { value: 'EXIT', label: 'Salida' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

const TYPE_LABEL = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste', TRANSFER: 'Transferencia' };

/**
 * Histórico inmutable de movimientos (ADR-008: sin PATCH/DELETE) + creación
 * de los cuatro tipos con sus permisos diferenciados del catálogo RBAC.
 */
export default function MovementsScreen() {
  const { can } = useAuth();
  const products = usePicklist('/products', (r) => r.name || r.sku || String(r._id));
  const warehouses = usePicklist('/warehouses', (r) => r.name || r.code || String(r._id));

  const [kind, setKind] = useState(null); // null | ENTRY | EXIT | ADJUSTMENT | TRANSFER
  const [typeFilter, setTypeFilter] = useState('');

  const query = useMemo(() => (typeFilter ? { type: typeFilter } : {}), [typeFilter]);
  const list = useList('/inventory/movements', query);

  const productLabels = useMemo(() => {
    const map = {};
    for (const o of products.options) map[o.value] = o.label;
    return map;
  }, [products.options]);
  const warehouseLabels = useMemo(() => {
    const map = {};
    for (const o of warehouses.options) map[o.value] = o.label;
    return map;
  }, [warehouses.options]);

  const nameOf = (v, labels) => {
    if (v && typeof v === 'object') return v.name || v.sku || v.code || String(v._id);
    if (!v) return '—';
    return labels[v] || String(v);
  };

  const fields = useMemo(() => {
    if (kind === 'TRANSFER') {
      return [
        { name: 'productId', label: 'Producto', type: 'select', options: products.options, required: true },
        { name: 'fromWarehouseId', label: 'Almacén origen', type: 'select', options: warehouses.options, required: true },
        { name: 'toWarehouseId', label: 'Almacén destino', type: 'select', options: warehouses.options, required: true },
        { name: 'quantity', label: 'Cantidad', type: 'number', required: true },
        { name: 'reason', label: 'Motivo' },
        { name: 'reference', label: 'Referencia (documento)' },
      ];
    }
    return [
      { name: 'productId', label: 'Producto', type: 'select', options: products.options, required: true },
      { name: 'warehouseId', label: 'Almacén', type: 'select', options: warehouses.options, required: true },
      {
        name: 'quantity',
        label: kind === 'ADJUSTMENT' ? 'Cantidad final (recuento)' : 'Cantidad',
        type: 'number',
        required: true,
      },
      {
        name: 'reason',
        label: 'Motivo',
        required: kind === 'ADJUSTMENT',
        hint: kind === 'ADJUSTMENT' ? 'Obligatorio en ajustes.' : undefined,
      },
      { name: 'reference', label: 'Referencia (documento)' },
    ];
  }, [kind, products.options, warehouses.options]);

  const submit = async (values) => {
    const path = {
      ENTRY: '/inventory/entries',
      EXIT: '/inventory/exits',
      ADJUSTMENT: '/inventory/adjustments',
      TRANSFER: '/inventory/transfers',
    }[kind];
    await api(path, { method: 'POST', body: values });
    setKind(null);
    list.reload();
  };

  const dateOf = (v) => {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString();
    } catch {
      return String(v);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        {can('inventory.movements.create') ? (
          <>
            <Pressable style={styles.btn} onPress={() => setKind('ENTRY')}>
              <Text style={styles.btnText}>＋ Entrada</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setKind('EXIT')}>
              <Text style={styles.btnText}>－ Salida</Text>
            </Pressable>
          </>
        ) : null}
        {can('inventory.adjustments.create') ? (
          <Pressable style={styles.btn} onPress={() => setKind('ADJUSTMENT')}>
            <Text style={styles.btnText}>⟳ Ajuste</Text>
          </Pressable>
        ) : null}
        {can('inventory.transfers.create') ? (
          <Pressable style={styles.btn} onPress={() => setKind('TRANSFER')}>
            <Text style={styles.btnText}>⇄ Transferencia</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filter}>
        <Text style={styles.label}>Tipo</Text>
        <Dropdown
          value={typeFilter || null}
          onChange={(v) => setTypeFilter(v || '')}
          options={TYPE_OPTIONS}
          placeholder="(todos)"
        />
      </View>

      <DataTable
        title="Movimientos de inventario"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'createdAt', label: 'Fecha', width: 150, render: (r) => <Text style={styles.td}>{dateOf(r.createdAt)}</Text> },
          { key: 'type', label: 'Tipo', width: 110, render: (r) => <Text style={styles.type}>{TYPE_LABEL[r.type] || r.type}</Text> },
          { key: 'productId', label: 'Producto', width: 190, render: (r) => <Text style={styles.td}>{nameOf(r.productId, productLabels)}</Text> },
          {
            key: 'warehouseId',
            label: 'Almacén',
            width: 170,
            render: (r) => (
              <Text style={styles.td}>
                {r.type === 'TRANSFER'
                  ? `${nameOf(r.fromWarehouseId, warehouseLabels)} → ${nameOf(r.toWarehouseId, warehouseLabels)}`
                  : nameOf(r.warehouseId, warehouseLabels)}
              </Text>
            ),
          },
          { key: 'quantity', label: 'Cantidad', width: 90, render: (r) => <Text style={styles.qty}>{Number(r.quantity ?? 0)}</Text> },
          { key: 'reason', label: 'Motivo', width: 170 },
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
        emptyText="Sin movimientos registrados."
      />

      <FormModal
        visible={Boolean(kind)}
        title={
          { ENTRY: 'Nueva entrada', EXIT: 'Nueva salida', ADJUSTMENT: 'Nuevo ajuste', TRANSFER: 'Nueva transferencia' }[
            kind
          ] || ''
        }
        fields={fields}
        initial={null}
        onSubmit={submit}
        onCancel={() => setKind(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filter: { minWidth: 220, maxWidth: 320, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  td: { fontSize: 14, color: '#0f172a' },
  type: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  qty: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
});
