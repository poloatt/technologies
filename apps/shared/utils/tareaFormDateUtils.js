import { format, setHours, setMinutes, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export function toDateOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Merge calendar day with time-of-day (schedule fields style). */
export function mergeDateAndTime(day, time) {
  const d = new Date(day);
  const t = time || new Date();
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d;
}

/** Merge day + time using startOfDay base (quick create / advanced fields style). */
export function mergeDateAndTimeFromDay(day, time) {
  const base = startOfDay(day || new Date());
  const t = time || new Date();
  return setMinutes(setHours(base, t.getHours()), t.getMinutes());
}

/** Deriva "todo el día" cuando no hay un flag explícito en formData. */
export function deriveAllDay(start, end) {
  if (!start) return true;
  const atMidnight = start.getHours() === 0 && start.getMinutes() === 0;
  if (!end) return atMidnight;
  const isEndOfDay = end.getHours() === 23 && end.getMinutes() >= 59;
  return atMidnight && isEndOfDay;
}

export function formatDatePill(day) {
  if (!day) return '';
  const raw = format(day, 'EEEE, d MMMM', { locale: es });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatTimePill(time) {
  return format(time || new Date(), 'HH:mm');
}

export function formatDeadlinePill(date) {
  if (!date) return null;
  return formatDatePill(date);
}
