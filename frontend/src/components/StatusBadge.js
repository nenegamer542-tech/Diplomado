import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Colores por valor de estado (badges consistentes en todas las pantallas). */
const COLORS = {
  active: '#047857',
  inactive: '#64748b',
  locked: '#b91c1c',
  suspended: '#b91c1c',
  DRAFT: '#64748b',
  APPROVED: '#047857',
  REJECTED: '#b91c1c',
  RELEASED: '#1d4ed8',
  DONE: '#047857',
  CANCELLED: '#64748b',
  POSTED: '#047857',
  VOID: '#64748b',
  NEW: '#1d4ed8',
  CONTACTED: '#6d28d9',
  QUALIFIED: '#b45309',
  WON: '#047857',
  LOST: '#b91c1c',
  SUCCESS: '#047857',
  FAILURE: '#b91c1c',
};

const LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
  locked: 'Bloqueado',
  suspended: 'Suspendido',
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  RELEASED: 'Liberada',
  DONE: 'Finalizada',
  CANCELLED: 'Cancelado',
  POSTED: 'Registrado',
  VOID: 'Anulado',
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  WON: 'Ganado',
  LOST: 'Perdido',
  SUCCESS: 'Éxito',
  FAILURE: 'Fallo',
};

/** Chip de estado: color + etiqueta en español, gris por defecto. */
export default function StatusBadge({ value }) {
  if (value === null || value === undefined || value === '') return null;
  const key = String(value);
  const color = COLORS[key] || '#475569';
  const label = LABELS[key] || key;
  return (
    <View style={[styles.chip, { backgroundColor: `${color}1A`, borderColor: `${color}66` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700' },
});
