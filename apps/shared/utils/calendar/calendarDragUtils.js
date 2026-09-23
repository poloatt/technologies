import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_DURATION_MINUTES,
  DRAG_SNAP_MINUTES,
  durationMinutesToHeightPx,
  getGridHeightPx,
  getTotalGridMinutes,
  startMinutesToTopPx,
} from './calendarLayout';
import {
  appendScheduleToNotes,
  stripScheduleFromNotes,
} from '../googleTasksScheduleNotes';

const isTaskCompletedLight = (t) => {
  if (!t) return false;
  if (t.completada === true || t.completada === 'true') return true;
  return String(t.estado || '').toUpperCase() === 'COMPLETADA';
};

export const dayDropId = (day) => `day:${format(day, 'yyyy-MM-dd')}`;

export const allDayDropId = (day) => `allday:${format(day, 'yyyy-MM-dd')}`;

export const parseDayDropId = (id) => {
  const raw = String(id || '');
  if (!raw.startsWith('day:')) return null;
  try {
    return startOfDay(parseISO(raw.slice(4)));
  } catch {
    return null;
  }
};

export const parseAllDayDropId = (id) => {
  const raw = String(id || '');
  if (!raw.startsWith('allday:')) return null;
  try {
    return startOfDay(parseISO(raw.slice(7)));
  } catch {
    return null;
  }
};

/** @returns {{ day: Date, zone: 'timed'|'allDay' }|null} */
export const parseCalendarDropTarget = (id) => {
  const allDay = parseAllDayDropId(id);
  if (allDay) return { day: allDay, zone: 'allDay' };
  const day = parseDayDropId(id);
  if (day) return { day, zone: 'timed' };
  return null;
};

export const getEventDragId = (event) => {
  const task = event?.task || {};
  const dayKey = event?.start ? format(event.start, 'yyyy-MM-dd') : 'nodate';
  const id = task._id || task.id || task.titulo || 'ev';
  const zone = event?.allDay ? 'allday' : 'timed';
  return `ev:${id}:${dayKey}:${zone}`;
};

/** Eventos importados de Google Calendar (v1 read-only) y virtuales no se arrastran. */
export const isCalendarTaskDraggable = (task) => {
  if (!task) return false;
  if (isTaskCompletedLight(task)) return false;
  if (task.virtual) return false;
  if (task.googleCalendarSync?.googleEventId) return false;
  return true;
};

const snapMinutes = (mins) => Math.round(mins / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

const gridStartMins = () => DAY_START_HOUR * 60;
const gridEndMins = () => (DAY_END_HOUR + 1) * 60;

const clampSnappedStart = (minsFromMidnight) => {
  const start = gridStartMins();
  const end = gridEndMins();
  const clamped = Math.max(start, Math.min(end - DRAG_SNAP_MINUTES, minsFromMidnight));
  return snapMinutes(clamped - start) + start;
};

/**
 * Convierte delta Y del arrastre en minutos (snap 15 min) relativos al inicio de la rejilla.
 */
export const deltaYToGridMinutes = (deltaY) => {
  const gridHeight = getGridHeightPx();
  const totalMinutes = getTotalGridMinutes();
  if (!gridHeight || !totalMinutes) return 0;
  const raw = (deltaY / gridHeight) * totalMinutes;
  return snapMinutes(raw);
};

/** Y relativa al top de la columna → minutos desde medianoche (snap 15). */
export const relativeYToStartMinutes = (relativeY) => {
  const gridHeight = getGridHeightPx();
  const totalMinutes = getTotalGridMinutes();
  if (!gridHeight || !totalMinutes) return gridStartMins();
  const raw = (relativeY / gridHeight) * totalMinutes;
  return clampSnappedStart(gridStartMins() + raw);
};

export const formatDragTimeLabel = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
};

/**
 * Preview live mientras se arrastra (misma lógica que al soltar).
 * @returns {{
 *   dayKey: string,
 *   zone: 'timed'|'allDay',
 *   topPx: number,
 *   heightPx: number,
 *   newStart: Date,
 *   newEnd: Date,
 *   startLabel: string,
 *   endLabel: string,
 *   allDay: boolean,
 * }|null}
 */
export const computeDragPreview = (dragEvent, overId, deltaY, relativeY) => {
  if (!dragEvent) return null;
  const target = parseCalendarDropTarget(overId);
  if (!target) return null;

  let move = null;
  if (target.zone === 'allDay') {
    move = computeAllDayMove(target.day);
  } else if (dragEvent.allDay) {
    move = computeAllDayToTimedMove(target.day, relativeY ?? 0);
  } else {
    move = computeEventMove(dragEvent, target.day, deltaY ?? 0);
  }
  if (!move) return null;

  const dayKey = format(target.day, 'yyyy-MM-dd');
  if (move.allDay) {
    return {
      dayKey,
      zone: 'allDay',
      topPx: 0,
      heightPx: 0,
      newStart: move.newStart,
      newEnd: move.newEnd,
      startLabel: 'Todo el día',
      endLabel: '',
      allDay: true,
    };
  }

  const startMins = move.newStart.getHours() * 60 + move.newStart.getMinutes();
  const tipo = String(dragEvent?.task?.tipo || 'TAREA').toUpperCase();
  const durationMin = tipo === 'EVENTO'
    ? Math.max(
      DRAG_SNAP_MINUTES,
      Math.round((move.newEnd.getTime() - move.newStart.getTime()) / 60000),
    )
    : DEFAULT_DURATION_MINUTES;

  // #region agent log
  if (typeof fetch !== 'undefined' && (durationMin > 60 || (dragEvent?.end && dragEvent?.start
    && (dragEvent.end - dragEvent.start) > 60 * 60 * 1000))) {
    fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
      body: JSON.stringify({
        sessionId: 'b064c0',
        runId: 'post-fix',
        hypothesisId: 'D1',
        location: 'calendarDragUtils.js:computeDragPreview',
        message: 'drag preview duration',
        data: {
          title: String(dragEvent?.task?.titulo || '').slice(0, 40),
          tipo,
          durationMin,
          startLabel: formatDragTimeLabel(move.newStart),
          endLabel: formatDragTimeLabel(move.newEnd),
          rawEventDurMin: dragEvent?.start && dragEvent?.end
            ? Math.round((dragEvent.end - dragEvent.start) / 60000)
            : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  return {
    dayKey,
    zone: 'timed',
    topPx: startMinutesToTopPx(startMins),
    heightPx: durationMinutesToHeightPx(durationMin),
    newStart: move.newStart,
    newEnd: move.newEnd,
    startLabel: formatDragTimeLabel(move.newStart),
    endLabel: formatDragTimeLabel(move.newEnd),
    allDay: false,
  };
};

/** Y del puntero relativa al rect del droppable `over`. */
export const relativeYFromDragEvent = (dragEvent) => {
  const { over, delta, activatorEvent } = dragEvent || {};
  if (!over?.rect) return 0;
  const clientY = activatorEvent?.clientY
    ?? activatorEvent?.touches?.[0]?.clientY
    ?? activatorEvent?.changedTouches?.[0]?.clientY;
  if (clientY == null) return Math.max(0, delta?.y ?? 0);
  return (clientY + (delta?.y ?? 0)) - over.rect.top;
};

const timedSyncPatch = (task) => ({
  ...(task?.googleTasksSync || {}),
  hasTimedSchedule: true,
  needsSync: true,
  syncStatus: 'pending',
});

/** Duración al arrastrar: TAREA = pill 30 min; EVENTO = duración real (cap 8h). */
export const getDragDurationMs = (event) => {
  const tipo = String(event?.task?.tipo || 'TAREA').toUpperCase();
  const defaultMs = DEFAULT_DURATION_MINUTES * 60 * 1000;
  if (tipo !== 'EVENTO') return defaultMs;

  if (!event?.start || !event?.end) return defaultMs;
  const raw = event.end.getTime() - event.start.getTime();
  if (!Number.isFinite(raw) || raw < 5 * 60 * 1000) return defaultMs;
  const maxMs = 8 * 60 * 60 * 1000;
  return Math.min(raw, maxMs);
};

/**
 * Calcula nueva fecha/hora al soltar un evento timed en otra columna día.
 */
export const computeEventMove = (event, targetDay, deltaY = 0) => {
  if (!event?.start || !event?.end || !targetDay) return null;

  const durationMs = getDragDurationMs(event);
  const deltaMinutes = deltaYToGridMinutes(deltaY);

  const startMinsFromMidnight = event.start.getHours() * 60 + event.start.getMinutes() + deltaMinutes;
  const snappedOffset = clampSnappedStart(startMinsFromMidnight);

  const newStart = new Date(targetDay);
  newStart.setHours(Math.floor(snappedOffset / 60), snappedOffset % 60, 0, 0);

  const newEnd = new Date(newStart.getTime() + durationMs);
  return { newStart, newEnd, allDay: false };
};

/** All-day → timed al soltar en la grilla horaria (usa Y relativa a la columna). */
export const computeAllDayToTimedMove = (targetDay, relativeY = 0) => {
  if (!targetDay) return null;
  const startMins = relativeYToStartMinutes(relativeY);
  const newStart = new Date(targetDay);
  newStart.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
  const newEnd = new Date(newStart.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  return { newStart, newEnd, allDay: false };
};

/** Mover / convertir a todo el día en targetDay. */
export const computeAllDayMove = (targetDay) => {
  if (!targetDay) return null;
  const newStart = startOfDay(targetDay);
  const newEnd = endOfDay(targetDay);
  return { newStart, newEnd, allDay: true };
};

export const applyTimedMoveToTask = (task, newStart, newEnd) => {
  const nextDescripcion = appendScheduleToNotes(
    stripScheduleFromNotes(task?.descripcion || ''),
    newStart,
    newEnd,
  );
  return {
    fechaInicio: newStart,
    fechaFin: newEnd,
    fechaVencimiento: newEnd,
    descripcion: nextDescripcion,
    clearTimedSchedule: false,
    googleTasksSync: timedSyncPatch(task),
  };
};

export const applyAllDayMoveToTask = (task, targetDay) => {
  const dayStart = startOfDay(targetDay);
  return {
    fechaInicio: dayStart,
    fechaFin: null,
    fechaVencimiento: dayStart,
    descripcion: stripScheduleFromNotes(task?.descripcion || ''),
    clearTimedSchedule: true,
    googleTasksSync: {
      ...(task?.googleTasksSync || {}),
      hasTimedSchedule: false,
      needsSync: true,
      syncStatus: 'pending',
    },
  };
};
