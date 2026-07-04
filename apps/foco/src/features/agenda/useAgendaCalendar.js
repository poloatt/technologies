import { useMemo } from 'react';
import {
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CADENCIA_WEEK_STARTS_ON } from '@shared/habits';
import { filterTasksInRange } from '@shared/utils/calendar/agendaCalendarUtils';

/**
 * Deriva eventos visibles para la vista día o semana.
 */
export function useAgendaCalendar(tasks, selectedDate, viewMode = 'day', objetivos = [], agendaView = 'ahora') {
  const range = useMemo(() => {
    const base = selectedDate || new Date();
    if (viewMode === 'week') {
      const start = startOfWeek(base, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
      const end = endOfWeek(base, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    return { start: startOfDay(base), end: endOfDay(base) };
  }, [selectedDate, viewMode]);

  const events = useMemo(
    () => filterTasksInRange(tasks, range.start, range.end, objetivos),
    [tasks, range.start, range.end, objetivos],
  );

  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const start = startOfWeek(selectedDate || new Date(), { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate, viewMode]);

  return { range, events, weekDays };
}
