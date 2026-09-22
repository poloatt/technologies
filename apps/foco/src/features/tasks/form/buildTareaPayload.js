/**
 * Normaliza datos de formulario/borrador a payload API de tarea.
 */
import {
  appendScheduleToNotes,
  isTimedScheduleInstant,
  stripScheduleFromNotes,
} from '@shared/utils/googleTasksScheduleNotes';

function normalizeObjetivoId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value._id || value.id || null;
  return String(value);
}

export function findObjetivoById(objetivos, objetivoId) {
  const id = normalizeObjetivoId(objetivoId);
  if (!id) return null;
  return (objetivos || []).find((o) => String(o._id || o.id) === String(id)) || null;
}

/**
 * Alinea googleTasksSync con el objetivo elegido (lista de Google correcta).
 * Devuelve un objeto plano mínimo (sin basura de spreads de docs Mongoose).
 */
export function mergeGoogleTasksSyncForSave(formData, { editingTarea = null, objetivos = [] } = {}) {
  const newObjetivoId = normalizeObjetivoId(formData.objetivo);
  const prevObjetivoId = normalizeObjetivoId(editingTarea?.objetivo);
  const objetivoChanged = Boolean(
    editingTarea && newObjetivoId && prevObjetivoId && newObjetivoId !== prevObjetivoId,
  );

  const prevSync = editingTarea?.googleTasksSync || {};
  const formSync = formData.googleTasksSync || {};
  const enabled = formSync.enabled ?? prevSync.enabled ?? false;

  if (!enabled && !prevSync.enabled) {
    return { enabled: false };
  }

  const objetivo = findObjetivoById(objetivos, newObjetivoId);
  const listFromObjetivo = objetivo?.googleTasksSync?.googleTaskListId || null;

  const merged = {
    enabled,
    googleTaskId: formSync.googleTaskId ?? prevSync.googleTaskId ?? null,
    googleTaskListId: listFromObjetivo
      || formSync.googleTaskListId
      || prevSync.googleTaskListId
      || null,
    syncStatus: formSync.syncStatus || prevSync.syncStatus || 'pending',
    needsSync: Boolean(formSync.needsSync ?? prevSync.needsSync),
    hasTimedSchedule: Boolean(formSync.hasTimedSchedule ?? prevSync.hasTimedSchedule),
    localVersion: formSync.localVersion ?? prevSync.localVersion ?? 0,
  };

  if (
    objetivoChanged
    || (listFromObjetivo && listFromObjetivo !== prevSync.googleTaskListId)
  ) {
    merged.needsSync = true;
    merged.syncStatus = 'pending';
    merged.localVersion = (merged.localVersion || 0) + 1;
  }

  return merged;
}

export function buildTareaPayload(formData, { editingTarea = null, objetivos = [] } = {}) {
  const toISOString = (dateValue, fallback = null) => {
    if (!dateValue) return fallback;
    try {
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
      if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
        return dateValue.toISOString();
      }
      return fallback;
    } catch {
      return fallback;
    }
  };

  const fechaInicio = toISOString(
    formData.fechaInicio,
    editingTarea?.fechaInicio
      ? toISOString(editingTarea.fechaInicio, new Date().toISOString())
      : new Date().toISOString(),
  );

  const tipo = formData.tipo === 'EVENTO' ? 'EVENTO' : 'TAREA';
  const fechaFin = toISOString(formData.fechaFin, null);
  const fechaVencimiento = toISOString(formData.fechaVencimiento, null);
  const clearTimed = Boolean(formData.clearTimedSchedule || formData.allDay);

  const payload = {
    titulo: formData.titulo,
    descripcion: formData.descripcion || '',
    estado: formData.estado || 'PENDIENTE',
    tipo,
    fechaInicio,
    fechaVencimiento,
    fechaFin,
    prioridad: formData.prioridad || 'BAJA',
    objetivo: formData.objetivo?._id || formData.objetivo || null,
    completada: formData.completada ?? (formData.estado === 'COMPLETADA'),
    subtareas: formData.subtareas || [],
    archivos: formData.archivos || [],
    rrule: formData.rrule || null,
    owners: Array.isArray(formData.owners)
      ? formData.owners.map((o) => o?._id || o?.id || o).filter(Boolean)
      : undefined,
    googleTasksSync: mergeGoogleTasksSyncForSave(formData, { editingTarea, objetivos }),
  };

  const startDate = fechaInicio ? new Date(fechaInicio) : null;
  const endDate = fechaFin
    ? new Date(fechaFin)
    : (fechaVencimiento ? new Date(fechaVencimiento) : null);
  const timed = !clearTimed
    && tipo === 'TAREA'
    && startDate
    && endDate
    && isTimedScheduleInstant(startDate, endDate);

  if (clearTimed) {
    payload.descripcion = stripScheduleFromNotes(payload.descripcion);
    payload.googleTasksSync = {
      ...payload.googleTasksSync,
      hasTimedSchedule: false,
      needsSync: true,
      syncStatus: 'pending',
    };
  } else if (timed) {
    payload.descripcion = appendScheduleToNotes(payload.descripcion, startDate, endDate);
    payload.googleTasksSync = {
      ...payload.googleTasksSync,
      hasTimedSchedule: true,
      needsSync: true,
      syncStatus: 'pending',
    };
  }
  if (editingTarea) {
    payload.usuario = editingTarea.usuario;
    payload.orden = editingTarea.orden;
    payload.pushCount = editingTarea.pushCount;
  }

  return payload;
}
