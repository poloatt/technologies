export const PROPIEDAD_TIPOS = [
  { value: 'CASA', label: 'Casa' },
  { value: 'DEPARTAMENTO', label: 'Departamento' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'TERRENO', label: 'Terreno' },
];

export function getPropiedadTipoLabel(tipo) {
  return PROPIEDAD_TIPOS.find((item) => item.value === tipo)?.label || tipo || '';
}

export function getPropiedadAlias(data) {
  return data?.alias || data?.titulo || 'Sin alias';
}

export function normalizePropiedadEstado(estado) {
  if (Array.isArray(estado)) return estado[0] || 'DISPONIBLE';
  return estado || 'DISPONIBLE';
}
