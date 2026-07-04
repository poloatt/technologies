import { useCallback, useMemo } from 'react';
import {
  addMinutes,
  differenceInMinutes,
  endOfDay,
  startOfDay,
} from 'date-fns';
import {
  deriveAllDay,
  mergeDateAndTimeFromDay as mergeDateAndTime,
  toDateOrNull,
} from '../utils/tareaFormDateUtils';

export function computeScheduleView({ fechaInicio, fechaFin, allDay }) {
  const scheduleStart = toDateOrNull(fechaInicio) || new Date();
  const scheduleEnd = toDateOrNull(fechaFin);
  const scheduleDay = startOfDay(scheduleStart);
  const scheduleDuration = scheduleEnd
    ? Math.max(5, differenceInMinutes(scheduleEnd, scheduleStart))
    : 60;
  const scheduleAllDay = allDay ?? deriveAllDay(scheduleStart, scheduleEnd);

  return {
    scheduleStart,
    scheduleEnd,
    scheduleDay,
    scheduleDuration,
    scheduleAllDay,
  };
}

export function buildScheduleUpdate({
  nextDay,
  nextTime,
  nextAllDay,
  nextDuration,
  scheduleDay,
  scheduleStart,
  scheduleAllDay,
  scheduleDuration,
}) {
  const day = nextDay ?? scheduleDay;
  const time = nextTime ?? scheduleStart;
  const allDay = nextAllDay ?? scheduleAllDay;
  const duration = nextDuration ?? scheduleDuration;

  let inicio;
  let fin;
  if (allDay) {
    inicio = startOfDay(day);
    fin = endOfDay(day);
  } else {
    inicio = mergeDateAndTime(day, time);
    fin = addMinutes(inicio, duration || 60);
  }

  return {
    allDay,
    fechaInicio: inicio,
    fechaFin: fin,
    day: startOfDay(inicio),
    time: inicio,
    durationMin: allDay ? duration : Math.max(5, differenceInMinutes(fin, inicio)),
  };
}

/**
 * Unified schedule state for TareaForm (formData) or QuickCreate (local state).
 */
export function useTaskSchedule({
  fechaInicio,
  fechaFin,
  allDay,
  onScheduleChange,
}) {
  const view = useMemo(
    () => computeScheduleView({ fechaInicio, fechaFin, allDay }),
    [fechaInicio, fechaFin, allDay],
  );

  const applySchedule = useCallback((patch = {}) => {
    const update = buildScheduleUpdate({
      ...view,
      nextDay: patch.nextDay,
      nextTime: patch.nextTime,
      nextAllDay: patch.nextAllDay,
      nextDuration: patch.nextDuration,
    });
    onScheduleChange?.(update);
    return update;
  }, [view, onScheduleChange]);

  return {
    ...view,
    applySchedule,
  };
}
