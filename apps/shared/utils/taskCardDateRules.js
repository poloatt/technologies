import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { isDateOnlyDueInstant, isDateOnlyDueRaw, parseTaskDate } from './taskDateUtils.js';
import { getNormalizedToday } from './dateUtils.js';

/** Compara una fecha de tarea con el día de calendario de prefs. */
export function isSameDayAsToday(date, now = getNormalizedToday()) {
  const parsed = date instanceof Date ? date : parseTaskDate(date);
  if (!parsed || Number.isNaN(parsed.getTime())) return false;
  return isSameDay(parsed, now);
}

function getTaskStart(task) {
  return parseTaskDate(task?.fechaInicio || task?.inicio || task?.start);
}

function getTaskDue(task) {
  const due = parseTaskDate(
    task?.fechaVencimiento || task?.vencimiento || task?.dueDate || task?.fecha,
  );
  if (due) return due;
  if (String(task?.tipo || '').toUpperCase() === 'EVENTO') {
    return parseTaskDate(task?.fechaFin);
  }
  return null;
}

function getRawField(task, fieldNames) {
  for (const field of fieldNames) {
    if (task?.[field] != null && task[field] !== '') return task[field];
  }
  return null;
}

/**
 * Fecha fin / límite para tarjetas y filas colapsadas.
 * TAREA → fechaVencimiento; EVENTO → fechaVencimiento o fechaFin (via getTaskDue).
 */
export function getTaskCardEndDate(task) {
  return getTaskDue(task);
}

/** Fin del bloque horario en tarjeta: fechaFin si existe, si no el due. */
export function getTaskCardScheduleEnd(task) {
  const fin = parseTaskDate(task?.fechaFin);
  if (fin) return fin;
  return getTaskDue(task);
}

/** Ocultar fecha fin/límite en tarjetas cuando cae en el día de hoy. */
export function shouldShowEndDateOnCard(date, now = getNormalizedToday()) {
  const parsed = date instanceof Date ? date : parseTaskDate(date);
  if (!parsed || Number.isNaN(parsed.getTime())) return false;
  return !isSameDayAsToday(parsed, now);
}

export function areSameTaskInstant(a, b) {
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

export function areSameTaskCalendarDay(a, b) {
  if (!a || !b) return false;
  return isSameDay(a, b);
}

function taskShowsTime(raw, parsed) {
  if (!parsed) return false;
  if (isDateOnlyDueRaw(raw) || isDateOnlyDueInstant(raw, parsed)) return false;
  if (parsed.getHours() === 12 && parsed.getMinutes() === 0) return false;
  return true;
}

function capitalizeFirst(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCardDate(date, isMobile) {
  if (!date) return '';
  if (isMobile) return format(date, 'dd/MM', { locale: es });
  return capitalizeFirst(format(date, 'EEEE, d MMM', { locale: es }));
}

function formatCardTime(date) {
  return format(date, 'HH:mm', { locale: es });
}

function formatSingleMoment(date, raw, isMobile, { showDate = true } = {}) {
  const hasTime = taskShowsTime(raw, date);
  if (!showDate && hasTime) return formatCardTime(date);
  const datePart = showDate ? formatCardDate(date, isMobile) : '';
  if (hasTime) {
    return datePart ? `${datePart} · ${formatCardTime(date)}` : formatCardTime(date);
  }
  return datePart || formatCardDate(date, isMobile);
}

function applyCase(value, uppercase) {
  return uppercase ? value.toUpperCase() : value;
}

/**
 * Etiqueta de fecha/hora para filas colapsadas de tareas (TareasTable, ObjetivosGrid, etc.).
 *
 * - Mismo instante inicio/fin → una sola vez
 * - Mismo día, horas distintas → "Domingo, 21 jun · 14:30 – 15:36"
 * - Días distintos → inicio – fin
 * - Respeta shouldShowEndDateOnCard (oculta fecha fin si es hoy)
 */
export function formatTaskCardSchedule(
  task,
  { isMobile = false, uppercase = true, now = getNormalizedToday() } = {},
) {
  const start = getTaskStart(task);
  const end = getTaskCardScheduleEnd(task);
  const startRaw = getRawField(task, ['fechaInicio', 'inicio', 'start']);
  const endRaw = getRawField(task, ['fechaFin', 'fechaVencimiento', 'vencimiento', 'dueDate', 'fecha']);

  if (!start && !end) return '---';

  const endVisible = end && shouldShowEndDateOnCard(end, now);

  if (!start && end) {
    if (!endVisible) return '';
    return applyCase(formatSingleMoment(end, endRaw, isMobile), uppercase);
  }

  if (start && (!end || !endVisible)) {
    if (end && !endVisible && areSameTaskCalendarDay(start, end)) {
      const startHasTime = taskShowsTime(startRaw, start);
      const endHasTime = taskShowsTime(endRaw, end);
      if (startHasTime && endHasTime && !areSameTaskInstant(start, end)) {
        return applyCase(`${formatCardTime(start)} – ${formatCardTime(end)}`, uppercase);
      }
      if (areSameTaskInstant(start, end)) {
        if (startHasTime) return applyCase(formatCardTime(start), uppercase);
        return '';
      }
    }
    if (!endVisible && isSameDayAsToday(start, now)) {
      if (taskShowsTime(startRaw, start)) {
        return applyCase(formatCardTime(start), uppercase);
      }
      return '';
    }
    return applyCase(formatSingleMoment(start, startRaw, isMobile), uppercase);
  }

  if (areSameTaskInstant(start, end)) {
    return applyCase(formatSingleMoment(start, startRaw, isMobile), uppercase);
  }

  if (areSameTaskCalendarDay(start, end)) {
    const startHasTime = taskShowsTime(startRaw, start);
    const endHasTime = taskShowsTime(endRaw, end);
    const datePart = formatCardDate(start, isMobile);
    if (startHasTime || endHasTime) {
      const times = startHasTime && endHasTime
        ? `${formatCardTime(start)} – ${formatCardTime(end)}`
        : (startHasTime ? formatCardTime(start) : formatCardTime(end));
      return applyCase(`${datePart} · ${times}`, uppercase);
    }
    return applyCase(datePart, uppercase);
  }

  const startLabel = formatSingleMoment(start, startRaw, isMobile);
  const endLabel = formatSingleMoment(end, endRaw, isMobile);
  return applyCase(`${startLabel} – ${endLabel}`, uppercase);
}
