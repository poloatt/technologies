import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { es } from './localeEs.js';
import { CADENCIA_WEEK_STARTS_ON } from '../habits/utils/cadenciaUtils.js';

export function shiftCalendarDate(date, navigationMode, direction) {
  const base = startOfDay(date || new Date());
  const delta = navigationMode === 'week'
    ? (direction === 'prev' ? -7 : 7)
    : (direction === 'prev' ? -1 : 1);
  return addDays(base, delta);
}

export function getTodayCalendarDate() {
  return startOfDay(new Date());
}

/** true si la vista día/semana actual ya incluye hoy. */
export function isViewingTodayInCalendar(date, viewMode = 'day') {
  if (!date) return false;
  const today = startOfDay(new Date());
  if (viewMode === 'day') {
    return startOfDay(date).getTime() === today.getTime();
  }
  const start = startOfWeek(date, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
  const end = endOfWeek(date, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
  return isWithinInterval(today, { start: startOfDay(start), end: endOfDay(end) });
}

export function formatCalendarNavLabel(date, navigationMode) {
  if (!date) return '';
  if (navigationMode === 'day') {
    return format(date, 'dd MMM yy', { locale: es });
  }
  const start = startOfWeek(date, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
  const end = endOfWeek(date, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'd', { locale: es })} – ${format(end, 'd MMM yy', { locale: es })}`;
  }
  return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yy', { locale: es })}`;
}

/** Encabezado tipo Google Calendar: día grande + mes/año. */
export function formatCalendarDayHeader(date) {
  if (!date) {
    return { weekday: '', dayNumber: '', monthYear: '' };
  }
  return {
    weekday: format(date, 'EEEE', { locale: es }),
    dayNumber: format(date, 'd', { locale: es }),
    monthYear: format(date, "MMMM yyyy", { locale: es }),
  };
}
