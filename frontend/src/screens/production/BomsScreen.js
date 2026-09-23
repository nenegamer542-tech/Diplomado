import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import StatusBadge from '../../components/StatusBadge';
import { invert, labelFor } from '../../lib/format';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
];

/**
 * Listas de materiales (BOM): sin DELETE; la baja es `status: inactive`.
 * El backend valida componentes repetidos y componentes = producto terminado.
 */
export default function BomsScreen() {
  const { can } = useAuth();
  const products = usePicklist('/products', (r) => r.name || r.sku || String(r._id));
  const list = useList('/production/boms');
  const [editing, setEditing] = useState(null);
  const productLabels = invert(products.options);

  const fields = useMemo(
    () => [
      { name: 'productId', label: 'Producto terminado', type: 'select', options: products.options, required: true },
      {
        name: 'components',
        label: 'Componentes',
        type: 'lines',
        required: true,
        itemFields: [
          { name: 'productId', label: 'Componente', type: 'select', options: products.options, required: true },
          { name: 'quantity', label: 'Cantidad', type: 'number', required: true },
        ],
      },
      { name: 'notes', label: 'Notas', type: 'textarea' },
      { name: 'status', label: 'Estado', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
    ],
    [products.options]
  );

  const submit = async (values) => {
    if (editing && editing._id) await api(`/production/boms/${editing._id}`, { method: 'PATCH', body: values });
    else await api('/production/boms', { method: 'POST', body: values });
    setEditing(null);
    list.reload();
  };

  return (
    <>
      <DataTable
        title="Listas de materiales"
        subtitle={`${list.total} registros`}
        columns={[
          { key: 'code', label: 'Código', width: 120 },
          { key: 'productId', label: 'Producto terminado', width: 200, render: (r) => <Text style={styles.td}>{labelFor(r.productId, productLabels)}</Text> },
          {
            key: 'components',
            label: 'Componentes',
            width: 110,
            render: (r) => <Text style={styles.td}>{Array.isArray(r.components) ? r.components.length : 0}</Text>,
          },
          { key: 'status', label: 'Estado', width: 110, render: (r) => <StatusBadge value={r.status} /> },
          { key: 'notes', label: 'Notas', width: 180 },
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
        onCreate={can('production.create') ? () => setEditing({}) : undefined}
        createLabel="Nueva lista"
        rowActions={(row) =>
          can('production.update') ? [{ label: 'Editar', onPress: () => setEditing(row) }] : []
        }
        emptyText="Sin listas de materiales."
      />

      <FormModal
        visible={Boolean(editing)}
        title={editing && editing._id ? 'Editar lista de materiales' : 'Nueva lista de materiales'}
        fields={fields}
        initial={editing}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
    </>
  );
}

const styles = { td: { fontSize: 14, color: '#0f172a' } };
