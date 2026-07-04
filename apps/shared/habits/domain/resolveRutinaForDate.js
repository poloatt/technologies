import { isSameDay } from 'date-fns';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '../../utils/dateUtils.js';

/**
 * Busca la rutina del día en contexto con comparación de fecha robusta.
 */
export function resolveRutinaForDate({ rutina, rutinas, targetDate }) {
  const resolvedTargetDate = targetDate || getNormalizedToday();
  const targetDateStr = formatDateForAPI(resolvedTargetDate);
  const isTargetToday = isSameDay(resolvedTargetDate, getNormalizedToday());

  const sameDay = (r) => {
    if (!r?.fecha) return false;
    try {
      return formatDateForAPI(parseAPIDate(r.fecha)) === targetDateStr;
    } catch {
      return String(r.fecha).startsWith(targetDateStr);
    }
  };

  if (rutina && sameDay(rutina)) return rutina;

  const list = Array.isArray(rutinas) ? rutinas : [];
  const found = list.find(sameDay);
  if (found) return found;

  if (isTargetToday && rutina?._id) return rutina;

  return null;
}
