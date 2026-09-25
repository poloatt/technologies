export const BODY_ZONES = [
  { id: 'ojos', label: 'Ojos' },
  { id: 'piel', label: 'Piel' },
  { id: 'sangre', label: 'Sangre' },
  { id: 'cabeza', label: 'Cabeza' },
  { id: 'pecho', label: 'Pecho' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'brazos', label: 'Brazos' },
  { id: 'piernas', label: 'Piernas' },
];

export const DEFAULT_CONTROLES = [
  { controlId: 'sangre', zona: 'sangre', label: 'Estudios de sangre', intervaloDias: 365 },
  { controlId: 'oftalmologia', zona: 'ojos', label: 'Revisión de oftalmología', intervaloDias: 365 },
  { controlId: 'dermatologia', zona: 'piel', label: 'Revisión de dermatología', intervaloDias: 365 },
];

export const SALUD_TIPOS = ['TURNO', 'ESTUDIO', 'REVISION', 'COPAGO'];
export const SALUD_ESTADOS = ['PENDIENTE', 'HECHO', 'CANCELADO'];

const DONE_TIPOS = new Set(['ESTUDIO', 'REVISION']);

function itemTime(item) {
  const time = new Date(item?.fecha).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Un control está vencido si no hay estudio o revisión HECHO,
 * o si el último HECHO más el plazo ya pasó.
 * Un turno PENDIENTE no apaga el vencimiento.
 */
export function resolveControlStatus(control, items = [], now = new Date()) {
  const related = (items || []).filter((item) => item?.controlId === control?.controlId);
  const hechos = related
    .filter((item) => item.estado === 'HECHO' && DONE_TIPOS.has(item.tipo))
    .sort((a, b) => itemTime(b) - itemTime(a));
  const last = hechos[0] || null;
  const lastFecha = last ? new Date(last.fecha) : null;
  const intervalo = Number(control?.intervaloDias) || 0;
  let vencido = true;
  let due = null;
  if (lastFecha && intervalo > 0) {
    due = new Date(lastFecha);
    due.setDate(due.getDate() + intervalo);
    vencido = due.getTime() < now.getTime();
  }
  const pendiente = related.some((item) => item.estado === 'PENDIENTE');
  return {
    vencido,
    lastFecha: lastFecha ? lastFecha.toISOString() : null,
    due: due ? due.toISOString() : null,
    pendiente,
  };
}

export function resolveControlesStatus(controles = [], items = [], now = new Date()) {
  return (controles || []).map((control) => ({
    ...control,
    ...resolveControlStatus(control, items, now),
  }));
}

export function zoneNeedsAttention(zona, controlesConEstado = []) {
  return controlesConEstado.some((control) => control.zona === zona && control.vencido);
}
