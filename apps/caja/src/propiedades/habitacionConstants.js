/** Alineado con `ICONOS_POR_TIPO` en backend (Habitaciones.js). */
export const HABITACION_ICONOS_POR_TIPO = {
  BAÑO: 'wc',
  TOILETTE: 'wc',
  DORMITORIO_DOBLE: 'bed',
  DORMITORIO_SIMPLE: 'single_bed',
  ESTUDIO: 'desktop_mac',
  COCINA: 'kitchen',
  DESPENSA: 'inventory_2',
  SALA_PRINCIPAL: 'weekend',
  PATIO: 'yard',
  JARDIN: 'park',
  TERRAZA: 'deck',
  LAVADERO: 'local_laundry_service',
  OTRO: 'room',
};

export const HABITACION_TIPO_OPTIONS = [
  { value: 'BAÑO', label: 'Baño' },
  { value: 'TOILETTE', label: 'Toilette' },
  { value: 'DORMITORIO_DOBLE', label: 'Dormitorio doble' },
  { value: 'DORMITORIO_SIMPLE', label: 'Dormitorio simple' },
  { value: 'ESTUDIO', label: 'Estudio' },
  { value: 'COCINA', label: 'Cocina' },
  { value: 'DESPENSA', label: 'Despensa' },
  { value: 'SALA_PRINCIPAL', label: 'Sala principal' },
  { value: 'PATIO', label: 'Patio' },
  { value: 'JARDIN', label: 'Jardín' },
  { value: 'TERRAZA', label: 'Terraza' },
  { value: 'LAVADERO', label: 'Lavadero' },
  { value: 'OTRO', label: 'Otro tipo…' },
];

export function getHabitacionIconoPorTipo(tipo) {
  return HABITACION_ICONOS_POR_TIPO[tipo] || 'room';
}

export function getHabitacionTipoLabel(tipo, nombrePersonalizado) {
  if (tipo === 'OTRO' && nombrePersonalizado) return nombrePersonalizado;
  return HABITACION_TIPO_OPTIONS.find((o) => o.value === tipo)?.label || tipo;
}

/** Etiqueta visible de propiedad (alias reemplazó titulo en el schema). */
export function getPropiedadDisplayLabel(propiedad) {
  if (!propiedad) return '';
  return propiedad.alias || propiedad.titulo || propiedad.nombre || 'Sin nombre';
}

/** Id string de un documento o ref populada. */
export function getDocumentId(doc) {
  if (doc == null) return '';
  if (typeof doc === 'string') return doc;
  return String(doc.id || doc._id || '');
}

/** Normaliza propiedad para selects (id + alias/título). */
export function normalizePropiedadForSelect(propiedad) {
  if (!propiedad) return null;
  const id = getDocumentId(propiedad);
  return {
    ...propiedad,
    id,
    label: getPropiedadDisplayLabel(propiedad) || 'Sin nombre',
  };
}

/** Filtra habitaciones por propiedad (propiedad o propiedadId, string u ObjectId). */
export function habitacionMatchesPropiedad(habitacion, propiedadId) {
  if (!habitacion || propiedadId == null || propiedadId === '') return false;
  const hProp = habitacion.propiedadId ?? habitacion.propiedad;
  return getDocumentId(hProp) === String(propiedadId);
}

export function normalizePropiedadesList(propiedades = []) {
  return propiedades.map(normalizePropiedadForSelect).filter((p) => p?.id);
}

export function buildHabitacionPayload({ propiedadId, tipo, nombrePersonalizado }) {
  return {
    propiedadId,
    tipo,
    icono: getHabitacionIconoPorTipo(tipo),
    ...(tipo === 'OTRO' && nombrePersonalizado
      ? { nombrePersonalizado: nombrePersonalizado.trim() }
      : {}),
  };
}
