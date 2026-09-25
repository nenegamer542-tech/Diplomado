import React from 'react';
import { TTTable } from '../design-system/components/TTTable';

/**
 * Re-exportación / Adaptador de DataTable hacia TTTable
 * Mantiene compatibilidad total con todas las pantallas de módulos (FASE 7 / TECTODE).
 */
export default function DataTable(props) {
  return <TTTable {...props} />;
}
