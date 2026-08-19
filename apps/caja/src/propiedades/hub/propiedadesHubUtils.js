import { getEstadoContrato } from '@shared/utils/contratoUtils';
import { getNombreTipoHabitacion, getPropiedadEstado } from '@shared/utils/propiedadUtils';

export function normalizeDocId(doc) {
  return doc?.id || doc?._id;
}

export function getPropiedadLabel(propiedad) {
  if (!propiedad) return 'Sin propiedad';
  return propiedad.alias || propiedad.titulo || 'Sin nombre';
}

export function getHabitacionLabel(habitacion) {
  if (!habitacion) return '—';
  if (habitacion.tipo === 'OTRO' && habitacion.nombrePersonalizado) {
    return habitacion.nombrePersonalizado;
  }
  return getNombreTipoHabitacion(habitacion.tipo) || habitacion.tipo || '—';
}

export function getHabitacionPropiedadLabel(habitacion, propiedadesById = {}) {
  if (habitacion?.propiedad && typeof habitacion.propiedad === 'object') {
    return getPropiedadLabel(habitacion.propiedad);
  }
  const id = habitacion?.propiedadId || habitacion?.propiedad;
  if (id && propiedadesById[id]) return getPropiedadLabel(propiedadesById[id]);
  return 'Sin propiedad';
}

export function getInquilinoNombre(inquilino) {
  if (!inquilino) return 'Sin nombre';
  return `${inquilino.nombre || ''} ${inquilino.apellido || ''}`.trim() || 'Sin nombre';
}

export function getContratoInquilinoNombre(contrato) {
  let inquilino = null;
  if (Array.isArray(contrato?.inquilino) && contrato.inquilino.length > 0) {
    inquilino = contrato.inquilino[0];
  } else if (contrato?.inquilino && typeof contrato.inquilino === 'object') {
    inquilino = contrato.inquilino;
  }
  return getInquilinoNombre(inquilino);
}

export function getContratoEstado(contrato) {
  return getEstadoContrato(contrato) || contrato?.estado || 'PLANEADO';
}

export function countContratosForInquilino(inquilinoId, contratos) {
  const id = String(inquilinoId);
  return contratos.filter((c) => {
    if (Array.isArray(c.inquilino)) {
      return c.inquilino.some((i) => String(i?._id || i?.id || i) === id);
    }
    if (c.inquilino) {
      return String(c.inquilino?._id || c.inquilino?.id || c.inquilino) === id;
    }
    return false;
  }).length;
}

export function countContratosByEstado(contratos) {
  const counts = { ACTIVO: 0, PLANEADO: 0, FINALIZADO: 0, MANTENIMIENTO: 0 };
  contratos.forEach((c) => {
    const estado = getContratoEstado(c);
    if (counts[estado] != null) counts[estado] += 1;
    else counts.PLANEADO += 1;
  });
  return counts;
}

export function countPropiedadesByEstado(propiedades) {
  const counts = { DISPONIBLE: 0, OCUPADA: 0, MANTENIMIENTO: 0, RESERVADA: 0 };
  propiedades.forEach((p) => {
    const estado = getPropiedadEstado(p);
    if (counts[estado] != null) counts[estado] += 1;
    else counts.DISPONIBLE += 1;
  });
  return counts;
}
