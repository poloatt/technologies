import {
  addMonths,
  isSameMonth,
  isThisMonth,
  isThisWeek,
  isThisYear,
  isToday,
  isTomorrow,
} from 'date-fns';
// Funciones de fecha sin date-fns (compartidas con el backend vía googleTasksScheduleNotes.js)
import {
  isDateOnlyDueRaw,
  isDateOnlyDueInstant,
  parseTaskDate,
  normalizeDateOnlyDue,
} from './taskDateUtils.js';
import { CADENCIA_WEEK_STARTS_ON } from '../habits/utils/cadenciaUtils.js';

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

export const getStartOfToday = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

export const getEndOfTomorrow = (now = new Date()) => {
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

export const isInAhora = (task, now = new Date()) => {
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

export const isInLuego = (task, now = new Date()) => {
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

export const getBucketAhora = (task, now = new Date()) => {
  const anchor = getAnchorDate(task);
  if (!anchor) return 'SIN FECHA';

  const startOfToday = getStartOfToday(now);

  // Overdue: se agrupa en HOY (sin bucket separado)
  if (anchor < startOfToday) return 'HOY';
  if (isToday(anchor)) return 'HOY';
  if (isTomorrow(anchor)) return 'MAÑANA';
  if (isThisWeek(anchor, WEEK_OPTS)) return 'ESTA SEMANA';
  if (isThisMonth(anchor)) return 'ESTE MES';
  // Nota: "próximo trimestre" = ventana móvil de ~3 meses hacia adelante
  if (anchor < addMonths(now, 3)) return 'PRÓXIMO TRIMESTRE';
  if (isThisYear(anchor)) return 'ESTE AÑO';
  return 'MÁS ADELANTE';
};

export const getBucketLuego = (task, now = new Date()) => {
  const anchor = getAnchorDate(task);
  if (!anchor) return 'SIN FECHA';

  if (isThisWeek(anchor, WEEK_OPTS)) return 'ESTA SEMANA';
  if (isThisMonth(anchor)) return 'ESTE MES';
  // Mes siguiente (calendario) como bucket propio
  if (isSameMonth(anchor, addMonths(now, 1))) return 'PRÓXIMO MES';
  if (anchor < addMonths(now, 3)) return 'PRÓXIMO TRIMESTRE';
  if (isThisYear(anchor)) return 'ESTE AÑO';
  return 'MÁS ADELANTE';
};

export const getAgendaBucket = (task, agendaView = 'ahora', now = new Date()) => {
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


