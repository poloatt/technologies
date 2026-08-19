import { getHabitacionLabel, getPropiedadLabel, normalizeDocId } from '../../propiedades/hub/propiedadesHubUtils';

export function normalizeInventarioItem(item) {
  return {
    ...item,
    id: normalizeDocId(item),
  };
}

export function getInventarioPropiedadId(item) {
  if (!item) return null;
  if (item.propiedadId) return String(item.propiedadId);
  if (item.propiedad?._id) return String(item.propiedad._id);
  if (item.propiedad) return String(item.propiedad);
  return null;
}

export function hasInventarioPropiedad(item) {
  return Boolean(getInventarioPropiedadId(item));
}

export function getInventarioRowSecondary(item) {
  if (item.habitacion && typeof item.habitacion === 'object') {
    const hab = getHabitacionLabel(item.habitacion);
    const prop = getPropiedadLabel(item.propiedad);
    return prop && prop !== 'Sin propiedad' ? `${hab} · ${prop}` : hab;
  }
  if (item.propiedad && typeof item.propiedad === 'object') {
    return getPropiedadLabel(item.propiedad);
  }
  return item.categoria || 'Sin locación';
}
