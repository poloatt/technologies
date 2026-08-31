import { isSameDay, startOfDay } from 'date-fns';
import { getNormalizedToday, parseAPIDate } from './dateUtils.js';

/** Modo del día activo respecto a hoy. */
export function getRutinaDayMode(fecha, today = getNormalizedToday()) {
  if (!fecha) return 'empty';
  try {
    const day = startOfDay(parseAPIDate(fecha));
    const todayStart = startOfDay(today);
    if (day < todayStart) return 'historical';
    if (isSameDay(day, todayStart)) return 'today';
    return 'future';
  } catch {
    return 'empty';
  }
}

export function isRutinaToday(fecha, today = getNormalizedToday()) {
  return getRutinaDayMode(fecha, today) === 'today';
}

export function isRutinaHistorical(fecha, today = getNormalizedToday()) {
  return getRutinaDayMode(fecha, today) === 'historical';
}

/** Preview o día futuro sin log: todos los pendientes comparten el mismo estilo plano. */
export function isRutinaFuturePreview(rutina, today = getNormalizedToday()) {
  if (!rutina) return false;
  if (rutina.isPreview) return true;
  return getRutinaDayMode(rutina.fecha, today) === 'future';
}
