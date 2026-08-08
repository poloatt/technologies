import { addDays, addWeeks, addMonths, isWeekend, startOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Ciclo Empujar: mañana hábil → +1 semana → 1º próximo mes → hoy.
 */
export function getNextPushDate(tarea, now = new Date()) {
  const step = (tarea?.pushCount || 0) % 4;
  let nuevaFecha;

  switch (step) {
    case 0:
      nuevaFecha = addDays(now, 1);
      while (isWeekend(nuevaFecha)) {
        nuevaFecha = addDays(nuevaFecha, 1);
      }
      break;
    case 1:
      nuevaFecha = addWeeks(now, 1);
      break;
    case 2:
      nuevaFecha = startOfMonth(addMonths(now, 1));
      break;
    case 3:
    default:
      nuevaFecha = now;
      break;
  }

  return nuevaFecha;
}

export function getNextPushTooltip(tarea, now = new Date()) {
  const date = getNextPushDate(tarea, now);
  const label = format(date, "d MMM yyyy", { locale: es });
  return `Empujar a ${label}`;
}
