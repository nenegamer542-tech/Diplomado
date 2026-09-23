import React, { useState } from 'react';
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

const FIELDS = [
  { name: 'sku', label: 'SKU', required: true, placeholder: 'PROD-001' },
  { name: 'name', label: 'Nombre', required: true },
  { name: 'barcode', label: 'Código de barras' },
  { name: 'category', label: 'Categoría' },
  { name: 'unit', label: 'Unidad (ud, kg…)' },
  { name: 'costPrice', label: 'Costo', type: 'number' },
  { name: 'salePrice', label: 'Precio de venta', type: 'number' },
  { name: 'taxRate', label: 'Impuesto (%)', type: 'number' },
  { name: 'minStock', label: 'Stock mínimo', type: 'number' },
  { name: 'description', label: 'Descripción', type: 'textarea' },
  { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
];

/** CRUD de productos (lectura, alta, edición y baja lógica por estado). */
export default function ProductsScreen() {
  const { can } = useAuth();
  const list = useList('/products');
  const [confirmUI, confirm] = useConfirm();
  const [editing, setEditing] = useState(null);

  const money = (n) => (n === null || n === undefined || n === '' ? '—' : `$${Number(n).toFixed(2)}`);

  const submit = async (values) => {
    if (editing && editing._id) await api(`/products/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/products', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Productos"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'sku', label: 'SKU', width: 110 },
          { key: 'name', label: 'Nombre', width: 210 },
          { key: 'category', label: 'Categoría', width: 120 },
          { key: 'costPrice', label: 'Costo', width: 90, render: (r) => <Text style={styles.td}>{money(r.costPrice)}</Text> },
          { key: 'salePrice', label: 'Precio', width: 90, render: (r) => <Text style={styles.td}>{money(r.salePrice)}</Text> },
          { key: 'minStock', label: 'Stock mín.', width: 90 },
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
        onCreate={can('products.create') ? () => setEditing({}) : undefined}
        rowActions={(row) => [
          ...(can('products.update')
            ? [{ label: 'Editar', onPress: () => setEditing(row) }]
            : []),
          ...(can('products.delete')
            ? [
                {
                  label: 'Eliminar',
                  danger: true,
                  onPress: () =>
                    confirm(`¿Eliminar el producto "${row.name}"? Esta acción no se puede deshacer.`, async () => {
                      await api(`/products/${row._id}`, { method: 'DELETE' });
                      list.reload();
                    }),
                },
              ]
            : []),
        ]}
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar producto' : 'Nuevo producto'}
        fields={FIELDS}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
      {confirmUI}
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' } };
