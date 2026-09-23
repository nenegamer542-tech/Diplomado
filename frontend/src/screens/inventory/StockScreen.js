import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DataTable from '../../components/DataTable';
import Dropdown from '../../components/Dropdown';
import { useList, usePicklist } from '../../hooks/useResource';

/**
 * Existencias por producto/almacén (sólo lectura; el stock se modifica con
 * entradas/salidas/ajustes/transferencias desde Movimientos).
 */
export default function StockScreen() {
  const products = usePicklist('/products', (r) => r.name || r.sku || String(r._id));
  const warehouses = usePicklist('/warehouses', (r) => r.name || r.code || String(r._id));

  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const query = useMemo(() => {
    const q = {};
    if (productId) q.productId = productId;
    if (warehouseId) q.warehouseId = warehouseId;
    return q;
  }, [productId, warehouseId]);

  const list = useList('/inventory/stock', query);

  // El backend puede devolver la referencia como ObjectId o como doc poblado.
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

  return (
    <View style={styles.wrap}>
      <View style={styles.filters}>
        <View style={styles.filter}>
          <Text style={styles.label}>Producto</Text>
          <Dropdown
            value={productId || null}
            onChange={(v) => setProductId(v || '')}
            options={products.options}
            placeholder="(todos)"
          />
        </View>
        <View style={styles.filter}>
          <Text style={styles.label}>Almacén</Text>
          <Dropdown
            value={warehouseId || null}
            onChange={(v) => setWarehouseId(v || '')}
            options={warehouses.options}
            placeholder="(todos)"
          />
        </View>
      </View>

      <DataTable
        title="Existencias"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'productId', label: 'Producto', width: 220, render: (r) => <Text style={styles.td}>{nameOf(r.productId, productLabels)}</Text> },
          { key: 'warehouseId', label: 'Almacén', width: 160, render: (r) => <Text style={styles.td}>{nameOf(r.warehouseId, warehouseLabels)}</Text> },
          { key: 'quantity', label: 'Cantidad', width: 110, render: (r) => <Text style={styles.qty}>{Number(r.quantity ?? 0)}</Text> },
        ]}
        rows={list.items}
        loading={list.loading}
        error={list.error}
        onRefresh={list.reload}
        page={list.page}
        total={list.total}
        limit={list.limit}
        onPageChange={list.setPage}
        emptyText="Sin existencias registradas."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  filters: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  filter: { minWidth: 220, flex: 1, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  td: { fontSize: 14, color: '#0f172a' },
  qty: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
});
