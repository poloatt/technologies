import { useCallback, useEffect, useState } from 'react';
import { shiftCalendarDate } from '@shared/utils/focoNavigationUtils';
import { getNormalizedToday } from '@shared/utils/dateUtils';

/** Sincroniza con `agendaCalendarState` y navega vía evento `navigate` (mismo contrato que RutinaNavigation). */
export function useAgendaCalendarNavChevrons(viewModeOverride) {
  const [calendarDate, setCalendarDate] = useState(() => getNormalizedToday());
  const [viewMode, setViewMode] = useState(() => (
    viewModeOverride === 'week' ? 'week' : 'day'
  ));

  useEffect(() => {
    const handleAgendaCalendarState = (event) => {
      const { date, viewMode: vm } = event.detail || {};
      if (date) setCalendarDate(new Date(date));
      if (vm === 'day' || vm === 'week') setViewMode(vm);
    };
    window.addEventListener('agendaCalendarState', handleAgendaCalendarState);
    return () => window.removeEventListener('agendaCalendarState', handleAgendaCalendarState);
  }, []);

  useEffect(() => {
    if (viewModeOverride === 'day' || viewModeOverride === 'week') {
      setViewMode(viewModeOverride);
    }
  }, [viewModeOverride]);

  const effectiveMode = viewModeOverride || viewMode;

  const dispatchCalendarNavigate = useCallback((direction, date) => {
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: {
        direction,
        date: (date || getNormalizedToday()).toISOString(),
      },
    }));
  }, []);

  const onPrevious = useCallback(() => {
    const nextDate = shiftCalendarDate(calendarDate, effectiveMode, 'prev');
    setCalendarDate(nextDate);
    dispatchCalendarNavigate('prev', nextDate);
  }, [calendarDate, dispatchCalendarNavigate, effectiveMode]);

  const onNext = useCallback(() => {
    const nextDate = shiftCalendarDate(calendarDate, effectiveMode, 'next');
    setCalendarDate(nextDate);
    dispatchCalendarNavigate('next', nextDate);
  }, [calendarDate, dispatchCalendarNavigate, effectiveMode]);

  const prevTooltip = effectiveMode === 'week' ? 'Semana anterior' : 'Día anterior';
  const nextTooltip = effectiveMode === 'week' ? 'Semana siguiente' : 'Día siguiente';

  return { onPrevious, onNext, prevTooltip, nextTooltip };
}
