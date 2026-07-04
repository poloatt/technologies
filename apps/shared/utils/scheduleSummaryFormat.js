import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getTimezoneInfo } from './timezoneConfig.js';
import {
  areSameTaskCalendarDay,
  areSameTaskInstant,
} from './taskCardDateRules.js';
import { parseTaskDate } from './taskDateUtils.js';

function capitalizeFirst(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCardTime(date) {
  return format(date, 'HH:mm', { locale: es });
}

function formatSummaryDate(date) {
  return capitalizeFirst(format(date, 'EEEE, d MMMM', { locale: es }));
}

function formatDeadlineSummary(deadline) {
  const date = deadline instanceof Date ? deadline : parseTaskDate(deadline);
  if (!date || Number.isNaN(date.getTime())) return null;
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const datePart = capitalizeFirst(format(date, 'EEEE, d MMM', { locale: es }));
  if (!hasTime) return `Fecha límite: ${datePart}`;
  return `Fecha límite: ${datePart} ${formatCardTime(date)}`;
}

/**
 * Etiqueta corta de zona horaria para la línea secundaria del resumen de horario.
 */
export function getScheduleTimezoneLabel(timezone) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const info = getTimezoneInfo(tz);
  if (info?.label) return info.label;

  try {
    const parts = new Intl.DateTimeFormat('es', {
      timeZone: tz,
      timeZoneName: 'longGeneric',
    }).formatToParts(new Date());
    const name = parts.find((part) => part.type === 'timeZoneName')?.value;
    if (name) return name;
  } catch {
    // ignore invalid timezone
  }

  return 'Zona horaria';
}

/**
 * Línea principal del resumen de horario (estilo Google Calendar).
 * Ej: "Sábado, 4 julio  18:00 – 18:25"
 */
export function formatScheduleSummaryPrimary(
  { fechaInicio, fechaFin, allDay },
) {
  const start = fechaInicio instanceof Date ? fechaInicio : parseTaskDate(fechaInicio);
  const end = fechaFin instanceof Date ? fechaFin : parseTaskDate(fechaFin);

  if (!start || Number.isNaN(start.getTime())) return 'Sin fecha';

  const datePart = formatSummaryDate(start);

  if (allDay) return datePart;

  if (!end || Number.isNaN(end.getTime()) || areSameTaskInstant(start, end)) {
    return `${datePart}  ${formatCardTime(start)}`;
  }

  if (areSameTaskCalendarDay(start, end)) {
    return `${datePart}  ${formatCardTime(start)} – ${formatCardTime(end)}`;
  }

  const endDatePart = formatSummaryDate(end);
  return `${datePart}  ${formatCardTime(start)} – ${endDatePart}  ${formatCardTime(end)}`;
}

/**
 * Línea secundaria del resumen: zona horaria • recurrencia (y todo el día si aplica).
 */
export function formatScheduleSummaryMeta(
  { rrule, allDay, timezone, deadline },
  { recurrenceLabel } = {},
) {
  const parts = [getScheduleTimezoneLabel(timezone)];

  if (allDay) {
    parts.push('Todo el día');
  }

  parts.push(recurrenceLabel || 'No se repite');

  const deadlineLabel = formatDeadlineSummary(deadline);
  if (deadlineLabel) {
    parts.push(deadlineLabel);
  }

  return parts.join(' • ');
}
