import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../components/Confirm';
import DataTable from '../../components/DataTable';
import DetailModal from '../../components/DetailModal';
import Dropdown from '../../components/Dropdown';
import { useList, usePicklist } from '../../hooks/useResource';

const STATUS = { DRAFT: 'Borrador', POSTING: 'Publicando', PARTIAL: 'Parcial', POSTED: 'Publicado' };
const TRACE_EXAMPLE = '[{"identifier":"LOTE-A","quantity":3,"expiryDate":"2028-01-01"}]';

export default function CountsScreen() {
  const { can } = useAuth();
  const warehouses = usePicklist('/warehouses', (row) => row.name || row.code || String(row._id));
  const list = useList('/inventory/counts');
  const [products, setProducts] = useState([]);
  const [visible, setVisible] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [detail, setDetail] = useState(null);
  const [confirmUI, confirm] = useConfirm();

  useEffect(() => {
    let cancelled = false;
    api('/products', { query: { limit: 100 } })
      .then((rows) => { if (!cancelled) setProducts(Array.isArray(rows) ? rows.filter((row) => row.status === 'active') : []); })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, []);

  const productOptions = useMemo(() => products.map((product) => ({
    value: String(product._id),
    label: `${product.sku} · ${product.name} (${trackingLabel(product.trackingMode)})`,
  })), [products]);
  const productById = useMemo(() => Object.fromEntries(products.map((product) => [String(product._id), product])), [products]);
  const warehouseById = useMemo(() => Object.fromEntries(warehouses.options.map((item) => [item.value, item.label])), [warehouses.options]);

  const openNew = () => {
    setWarehouseId('');
    setLines([emptyLine()]);
    setFormError('');
    setVisible(true);
  };

  const updateLine = (index, patch) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (index) => setLines((current) => current.length > 1 ? current.filter((_, i) => i !== index) : current);

  const createCount = async () => {
    setFormError('');
    if (!warehouseId) return setFormError('Seleccione un almacén.');
    const used = new Set();
    const payloadLines = [];
    try {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const product = productById[line.productId];
        if (!product) throw new Error(`Seleccione el producto de la línea ${index + 1}.`);
        if (used.has(line.productId)) throw new Error('Cada producto debe aparecer una sola vez en el conteo.');
        used.add(line.productId);
        if (!line.countedQuantity.trim()) throw new Error(`Ingrese la cantidad contada de ${product.sku}.`);
        const countedQuantity = Number(line.countedQuantity);
        if (!Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error(`La cantidad contada de ${product.sku} debe ser un número igual o mayor que cero.`);

        const payloadLine = { productId: line.productId, countedQuantity };
        const mode = product.trackingMode || 'none';
        if (mode !== 'none') {
          let traceability;
          try { traceability = JSON.parse(line.traceabilityText || '[]'); }
          catch { throw new Error(`El detalle de lote/serie de ${product.sku} debe ser JSON válido.`); }
          if (!Array.isArray(traceability)) throw new Error(`El detalle de ${product.sku} debe ser una lista JSON.`);
          traceability = traceability.map((item) => ({ ...item, identifier: item.identifier.trim(), quantity: Number(item.quantity) }));
          validateTraceCount(mode, countedQuantity, traceability, product.sku);
          payloadLine.traceability = traceability;
        } else if (line.traceabilityText.trim()) {
          throw new Error(`${product.sku} no requiere detalle de lote o serie.`);
        }
        payloadLines.push(payloadLine);
      }
      setBusy(true);
      const created = await api('/inventory/counts', { method: 'POST', body: { warehouseId, lines: payloadLines } });
      setDetail(created);
      setVisible(false);
      list.reload();
    } catch (error) {
      setFormError(error.message || 'No se pudo crear el conteo.');
    } finally {
      setBusy(false);
    }
  };

  const postCount = (count) => confirm(
    `¿Publicar ${count.code}? El ajuste actualizará existencias y su trazabilidad.`,
    async () => {
      await api(`/inventory/counts/${count._id}/post`, { method: 'POST', body: {} });
      list.reload();
    }
  );

  const dateOf = (value) => value ? new Date(value).toLocaleString() : '—';
  const mayPost = can('inventory.adjustments.create');
  const detailRows = (detail?.lines || []).map((line) => ({
    ...line,
    productLabel: productById[String(line.productId)]?.sku || String(line.productId),
    countedTrace: JSON.stringify(line.countedTraceability || []),
  }));

  return (
    <View style={styles.wrap}>
      <DataTable
        title="Inventarios físicos"
        subtitle={`${list.total} conteos`}
        columns={[
          { key: 'code', label: 'Código', width: 130 },
          { key: 'warehouseId', label: 'Almacén', width: 180, render: (row) => <Text style={styles.cell}>{warehouseById[String(row.warehouseId)] || String(row.warehouseId)}</Text> },
          { key: 'status', label: 'Estado', width: 120, render: (row) => <Text style={[styles.status, row.status === 'POSTED' && styles.statusDone]}>{STATUS[row.status] || row.status}</Text> },
          { key: 'lines', label: 'Productos', width: 100, render: (row) => <Text style={styles.cell}>{row.lines?.length || 0}</Text> },
          { key: 'createdAt', label: 'Creado', width: 190, render: (row) => <Text style={styles.cell}>{dateOf(row.createdAt)}</Text> },
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
        onCreate={mayPost ? openNew : undefined}
        createLabel="Nuevo conteo"
        rowActions={(row) => [
          { label: 'Detalle', onPress: () => setDetail(row) },
          ...(mayPost && ['DRAFT', 'PARTIAL'].includes(row.status)
            ? [{ label: 'Publicar', onPress: () => postCount(row) }]
            : []),
        ]}
        emptyText="Sin inventarios físicos registrados."
      />

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && setVisible(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialog}>
            <Text style={styles.title}>Nuevo inventario físico</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formBody}>
              <View style={styles.field}>
                <Text style={styles.label}>Almacén</Text>
                <Dropdown value={warehouseId || null} onChange={(value) => setWarehouseId(value || '')} options={warehouses.options} placeholder="Seleccione almacén" />
              </View>

              {lines.map((line, index) => {
                const product = productById[line.productId];
                const mode = product?.trackingMode || 'none';
                const availableOptions = productOptions.filter((option) => option.value === line.productId || !lines.some((other, otherIndex) => otherIndex !== index && other.productId === option.value));
                return (
                  <View key={`count-line-${index}`} style={styles.line}>
                    <View style={styles.lineHeader}>
                      <Text style={styles.lineTitle}>Producto {index + 1}</Text>
                      {lines.length > 1 ? <Pressable onPress={() => removeLine(index)}><Text style={styles.remove}>Quitar</Text></Pressable> : null}
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Producto</Text>
                      <Dropdown value={line.productId || null} onChange={(value) => updateLine(index, { productId: value || '', traceabilityText: '' })} options={availableOptions} placeholder="Seleccione producto" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Cantidad contada</Text>
                      <TextInput style={styles.input} value={line.countedQuantity} onChangeText={(value) => updateLine(index, { countedQuantity: value })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#94a3b8" />
                    </View>
                    {mode !== 'none' ? (
                      <View style={styles.field}>
                        <Text style={styles.label}>Detalle {mode === 'lot' ? 'de lotes' : 'de series'} (JSON)</Text>
                        <TextInput style={[styles.input, styles.textarea]} value={line.traceabilityText} onChangeText={(value) => updateLine(index, { traceabilityText: value })} multiline autoCapitalize="none" placeholder={TRACE_EXAMPLE} placeholderTextColor="#94a3b8" />
                        <Text style={styles.hint}>{mode === 'lot' ? 'Las cantidades de todos los lotes deben sumar la cantidad contada.' : 'Indique una serie única por cada unidad contada; cada cantidad debe ser 1.'}</Text>
                      </View>
                    ) : product ? <Text style={styles.hint}>Este producto no tiene control de lote o serie.</Text> : null}
                  </View>
                );
              })}
              <Pressable style={styles.addLine} onPress={addLine}><Text style={styles.addLineText}>+ Agregar producto</Text></Pressable>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
            </ScrollView>
            <View style={styles.footer}>
              <Pressable style={[styles.button, styles.cancel]} onPress={() => setVisible(false)} disabled={busy}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <Pressable style={[styles.button, styles.save, busy && styles.disabled]} onPress={createCount} disabled={busy}><Text style={styles.saveText}>{busy ? 'Guardando…' : 'Guardar conteo'}</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <DetailModal
        visible={Boolean(detail)}
        title={`Inventario ${detail?.code || ''}`}
        entries={detail ? [
          { label: 'Almacén', value: <Text style={styles.cell}>{warehouseById[String(detail.warehouseId)] || String(detail.warehouseId)}</Text> },
          { label: 'Estado', value: <Text style={styles.cell}>{STATUS[detail.status] || detail.status}</Text> },
          { label: 'Creado', value: <Text style={styles.cell}>{dateOf(detail.createdAt)}</Text> },
          ...(detail.postedAt ? [{ label: 'Publicado', value: <Text style={styles.cell}>{dateOf(detail.postedAt)}</Text> }] : []),
        ] : []}
        columns={[
          { key: 'productLabel', label: 'Producto', width: 130 },
          { key: 'expectedQuantity', label: 'Esperado', width: 90 },
          { key: 'countedQuantity', label: 'Contado', width: 90 },
          { key: 'countedTrace', label: 'Trazabilidad contada', width: 300 },
        ]}
        rows={detailRows}
        onClose={() => setDetail(null)}
      />
      {confirmUI}
    </View>
  );
}

function emptyLine() { return { productId: '', countedQuantity: '', traceabilityText: '' }; }
function trackingLabel(mode) { return mode === 'lot' ? 'lote' : mode === 'serial' ? 'serie' : 'sin trazabilidad'; }

function validateTraceCount(mode, quantity, traceability, sku) {
  if (mode === 'lot') {
    if (traceability.some((item) => !item || typeof item.identifier !== 'string' || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      throw new Error(`Cada lote de ${sku} requiere identificador y cantidad mayor que cero.`);
    }
    const identifiers = traceability.map((item) => item.identifier.trim().toUpperCase());
    if (new Set(identifiers).size !== identifiers.length) throw new Error(`No repita lotes de ${sku}.`);
    const total = traceability.reduce((sum, item) => sum + Number(item.quantity), 0);
    if (Math.abs(total - quantity) > 1e-8) throw new Error(`Las cantidades por lote de ${sku} deben sumar ${quantity}.`);
  } else {
    if (!Number.isInteger(quantity) || traceability.length !== quantity || traceability.some((item) => !item || typeof item.identifier !== 'string' || Number(item.quantity) !== 1)) {
      throw new Error(`Indique una serie única por cada unidad contada de ${sku}.`);
    }
    const identifiers = traceability.map((item) => item.identifier.trim().toUpperCase());
    if (new Set(identifiers).size !== identifiers.length) throw new Error(`No repita series de ${sku}.`);
  }
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  cell: { fontSize: 14, color: '#0f172a' },
  status: { color: '#a16207', fontWeight: '700', fontSize: 13 },
  statusDone: { color: '#15803d' },
  backdrop: { flex: 1, backgroundColor: '#0f172a66', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 680, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  title: { fontSize: 19, fontWeight: '700', color: '#0f172a' },
  formBody: { gap: 12, paddingBottom: 8 },
  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#0f172a', backgroundColor: '#fff' },
  textarea: { minHeight: 88, textAlignVertical: 'top', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  hint: { fontSize: 12, color: '#64748b' },
  line: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, gap: 10, backgroundColor: '#f8fafc' },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  remove: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  addLine: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addLineText: { color: '#2563eb', fontWeight: '600' },
  error: { color: '#b91c1c', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  cancel: { backgroundColor: '#f1f5f9' },
  cancelText: { color: '#334155', fontWeight: '600' },
  save: { backgroundColor: '#2563eb' },
  disabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '600' },
});
