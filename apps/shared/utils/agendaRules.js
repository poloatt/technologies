import {
  addMonths,
  isSameDay,
  isSameMonth,
  isThisMonth,
  isThisWeek,
  isThisYear,
} from 'date-fns';
// Funciones de fecha sin date-fns (compartidas con el backend vía googleTasksScheduleNotes.js)
import {
  isDateOnlyDueRaw,
  isDateOnlyDueInstant,
  parseTaskDate,
  normalizeDateOnlyDue,
} from './taskDateUtils.js';
import { CADENCIA_WEEK_STARTS_ON } from '../habits/utils/cadenciaUtils.js';
import { getNormalizedToday } from './dateUtils.js';

export { isDateOnlyDueRaw, isDateOnlyDueInstant, parseTaskDate, normalizeDateOnlyDue };

const WEEK_OPTS = { weekStartsOn: CADENCIA_WEEK_STARTS_ON };

/**
 * Reglas de agenda (AHORA/LUEGO) basadas en best practices:
 * - `due` representa el compromiso (lo que vence).
 * - `start` representa disponibilidad (fallback cuando no hay due).
 *
 * Glosario: @see agendaTerminology — taskHorizon.ahora / taskHorizon.luego
 *
 * Nota: las tareas pueden traer hora (ISO con `T`), por lo que NO usamos `parseAPIDate`.
 */

export const isTaskCompleted = (t) => {
  if (!t) return false;
  if (t.completada === true || t.completada === 'true') return true;
  const estado = String(t.estado || '').toUpperCase();
  if (estado === 'COMPLETADA') return true;
  const gCompleted = t.googleTasksSync?.completed;
  if (gCompleted instanceof Date) return !Number.isNaN(gCompleted.getTime());
  if (typeof gCompleted === 'string' && gCompleted.trim()) return true;
  return false;
};

export const getTaskStart = (t) =>
  parseTaskDate(t?.fechaInicio || t?.inicio || t?.start);

export const getTaskDue = (t) => {
  const due = parseTaskDate(
    t?.fechaVencimiento || t?.vencimiento || t?.dueDate || t?.fecha,
  );
  if (due) return due;
  if (String(t?.tipo || '').toUpperCase() === 'EVENTO') {
    return parseTaskDate(t?.fechaFin);
  }
  return null;
};

/** Inicio del día de calendario (prefs TZ por defecto; `now` inyectable en tests). */
export const getStartOfToday = (now = getNormalizedToday()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

export const getEndOfTomorrow = (now = getNormalizedToday()) => {
  const startOfToday = getStartOfToday(now);
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setDate(startOfToday.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);
  return endOfTomorrow;
};

/**
 * Ancla de agenda:
 * - Si hay due -> due manda.
 * - Si no hay due -> start.
 * - Si no hay fechas -> null.
 */
export const getAnchorDate = (task) => {
  const due = getTaskDue(task);
  if (due) return due;
  const start = getTaskStart(task);
  return start || null;
};

export const isInAhora = (task, now = getNormalizedToday()) => {
  const due = getTaskDue(task);
  const start = getTaskStart(task);
  const endOfTomorrow = getEndOfTomorrow(now);

  // sin fechas => AHORA
  if (!due && !start) return true;
  // due manda si existe
  if (due) return due <= endOfTomorrow;
  // fallback start
  return start <= endOfTomorrow;
};

export const isInLuego = (task, now = getNormalizedToday()) => {
  const due = getTaskDue(task);
  const start = getTaskStart(task);
  const endOfTomorrow = getEndOfTomorrow(now);

  // sin fechas => no es LUEGO (se queda en AHORA)
  if (!due && !start) return false;
  // due manda si existe
  if (due) return due > endOfTomorrow;
  // fallback start
  return start > endOfTomorrow;
};

export const getBucketAhora = (task, now = getNormalizedToday()) => {
  const anchor = getAnchorDate(task);
  if (!anchor) return 'SIN FECHA';

  const startOfToday = getStartOfToday(now);
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(startOfToday.getDate() + 1);

  // Overdue: se agrupa en HOY (sin bucket separado)
  if (anchor < startOfToday) return 'HOY';
  if (isSameDay(anchor, startOfToday)) return 'HOY';
  if (isSameDay(anchor, tomorrow)) return 'MAÑANA';
  if (isThisWeek(anchor, WEEK_OPTS)) return 'ESTA SEMANA';
  if (isThisMonth(anchor)) return 'ESTE MES';
  // Nota: "próximo trimestre" = ventana móvil de ~3 meses hacia adelante
  if (anchor < addMonths(startOfToday, 3)) return 'PRÓXIMO TRIMESTRE';
  if (isThisYear(anchor)) return 'ESTE AÑO';
  return 'MÁS ADELANTE';
};

export const getBucketLuego = (task, now = getNormalizedToday()) => {
  const anchor = getAnchorDate(task);
  if (!anchor) return 'SIN FECHA';

  const startOfToday = getStartOfToday(now);

  if (isThisWeek(anchor, WEEK_OPTS)) return 'ESTA SEMANA';
  if (isThisMonth(anchor)) return 'ESTE MES';
  // Mes siguiente (calendario) como bucket propio
  if (isSameMonth(anchor, addMonths(startOfToday, 1))) return 'PRÓXIMO MES';
  if (anchor < addMonths(startOfToday, 3)) return 'PRÓXIMO TRIMESTRE';
  if (isThisYear(anchor)) return 'ESTE AÑO';
  return 'MÁS ADELANTE';
};

export const getAgendaBucket = (task, agendaView = 'ahora', now = getNormalizedToday()) => {
  if (agendaView === 'luego') return getBucketLuego(task, now);
  return getBucketAhora(task, now);
};

export const getAgendaSortKey = (task) => getAnchorDate(task);

export {
  areSameTaskCalendarDay,
  areSameTaskInstant,
  formatTaskCardSchedule,
  getTaskCardEndDate,
  getTaskCardScheduleEnd,
  isSameDayAsToday,
  shouldShowEndDateOnCard,
} from './taskCardDateRules.js';


