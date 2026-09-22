import { addMinutes, endOfDay, isSameDay, startOfDay, format } from 'date-fns';
import {
  getAnchorDate,
  getTaskDue,
  getTaskStart,
  isDateOnlyDueInstant,
  isDateOnlyDueRaw,
  isTaskCompleted,
  normalizeDateOnlyDue,
  parseTaskDate,
} from '@shared/utils/agendaRules';
import { isTimedScheduleInstant, parseScheduleFromNotes, taskHasTimedSchedule } from '@shared/utils/googleTasksScheduleNotes';
import { normalizeTaskList } from '@shared/utils/taskListUtils';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_DURATION_MINUTES,
  getGridHeightPx,
  getTotalGridMinutes,
  HALF_SLOT_HEIGHT_PX,
  MIN_EVENT_HEIGHT_PX,
  SLOT_MINUTES,
  TASK_PILL_HEIGHT_PX,
} from './calendarLayout';

/** Máx. columnas solapadas en la rejilla horaria (evita “código de barras”). */
export const MAX_OVERLAP_COLUMNS = 6;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const calendarDayKey = (date) => format(date, 'yyyy-MM-dd');

const isDateOnlyString = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isGoogleTaskOrigin = (task) => Boolean(
  task?.googleTasksSync?.googleTaskId
  || task?.googleTasksSync?.enabled
  || task?.googleTasksSync?.googleTaskListId,
);

/** Google Tasks no tiene hora en due; legacy UTC puede caer a las 9:00 local. */
function isGoogleDateOnlyDue(task) {
  const rawDue = task?.fechaVencimiento || task?.vencimiento;
  const rawStart = task?.fechaInicio || task?.inicio || task?.start;
  for (const raw of [rawDue, rawStart]) {
    if (!raw) continue;
    if (isDateOnlyDueRaw(raw)) return true;
    const d = parseTaskDate(raw);
    if (d && isDateOnlyDueInstant(raw, d)) return true;
  }
  if (!isGoogleTaskOrigin(task)) return false;
  const d = parseTaskDate(rawDue || rawStart);
  if (!d) return false;
  // Sin minutos/segundos → due de Google (incluye 9:00 por T12:00:00Z en UTC-3).
  return d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

export const isAllDayTask = (task) => {
  // Flag explícito de Google Calendar (UTC noon no pasa heurísticas locales)
  if (task?.googleCalendarSync?.allDay === true) return true;
  if (
    task?.googleCalendarSync?.googleEventId
    && task?.googleCalendarSync?.allDay === false
  ) {
    return false;
  }

  if (taskHasTimedSchedule(task)) return false;

  const schedule = parseScheduleFromNotes(task?.descripcion || '');
  if (schedule?.fechaInicio && schedule?.fechaFin) return false;

  const rawStart = task?.fechaInicio || task?.inicio || task?.start;
  const tipo = String(task?.tipo || 'TAREA').toUpperCase();
  const rawDue = tipo === 'EVENTO'
    ? (task?.fechaVencimiento || task?.fechaFin || task?.vencimiento)
    : (task?.fechaVencimiento || task?.vencimiento);
  if (isDateOnlyString(rawStart) || isDateOnlyString(rawDue)) return true;

  const start = tipo === 'EVENTO'
    ? (getTaskStart(task) || getTaskDue(task))
    : (getAnchorDate(task) || getTaskStart(task) || getTaskDue(task));
  if (!start) return true;

  const endRaw = task?.fechaFin || (tipo === 'EVENTO' ? task?.fechaVencimiento : null);
  const end = parseTaskDate(endRaw || task?.fechaVencimiento);
  if (start && end && isTimedScheduleInstant(start, end)) return false;

  if (tipo !== 'EVENTO' && isGoogleDateOnlyDue(task)) return true;

  if (!endRaw) {
    return start.getHours() === 0 && start.getMinutes() === 0;
  }

  if (!end) return start.getHours() === 0 && start.getMinutes() === 0;

  return (
    start.getHours() === 0
    && start.getMinutes() === 0
    && end.getHours() === 0
    && end.getMinutes() === 0
  );
};

export const getObjetivoMeta = (task, objetivos = []) => {
  const objetivoId = task?.objetivo?._id || task?.objetivo;
  if (!objetivoId) return null;
  const found = objetivos.find((p) => String(p._id) === String(objetivoId));
  return found
    ? { id: found._id, nombre: found.nombre || found.titulo, color: found.color }
    : { id: objetivoId, nombre: 'OBJETIVO', color: null };
};

/**
 * @returns {{ task, start: Date, end: Date, allDay: boolean, completed: boolean, objetivo: object|null }|null}
 */
export const taskToCalendarEvent = (task, objetivos = []) => {
  if (!task) return null;

  const tipo = String(task?.tipo || 'TAREA').toUpperCase();
  const allDay = isAllDayTask(task);
  const scheduleFromNotes = parseScheduleFromNotes(task?.descripcion || '');
  const rawAnchor = tipo === 'EVENTO'
    ? (task?.fechaInicio || task?.inicio || task?.start || task?.fechaVencimiento || task?.vencimiento)
    : (task?.fechaVencimiento || task?.vencimiento || task?.fechaInicio || task?.inicio || task?.start);

  let start = null;
  if (scheduleFromNotes?.fechaInicio) {
    start = scheduleFromNotes.fechaInicio;
  } else if (tipo === 'EVENTO') {
    start = getTaskStart(task) || getTaskDue(task);
  } else if (taskHasTimedSchedule(task)) {
    start = getTaskStart(task) || getAnchorDate(task) || getTaskDue(task);
  } else {
    start = getAnchorDate(task) || getTaskStart(task) || getTaskDue(task);
  }
  if (!start) return null;

  const endFromFin = parseTaskDate(task?.fechaFin);
  const endFromDue = parseTaskDate(task?.fechaVencimiento);

  if (allDay) {
    // Google Calendar all-day: fechas en UTC noon — usar componentes UTC del día
    const calendarAllDay = Boolean(task?.googleCalendarSync?.allDay);
    const toLocalDayStart = (d) => {
      if (!d) return null;
      if (calendarAllDay) {
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
      }
      return normalizeDateOnlyDue(d) || startOfDay(d);
    };
    const dayStart = toLocalDayStart(parseTaskDate(rawAnchor) || start) || startOfDay(start);
    let dayEndSource = endFromFin || endFromDue || dayStart;
    const dayEnd = calendarAllDay && dayEndSource
      ? new Date(
        dayEndSource.getUTCFullYear(),
        dayEndSource.getUTCMonth(),
        dayEndSource.getUTCDate(),
        23,
        59,
        59,
        999,
      )
      : endOfDay(toLocalDayStart(dayEndSource) || dayStart);

    return {
      task,
      start: startOfDay(dayStart),
      end: dayEnd < dayStart ? endOfDay(dayStart) : dayEnd,
      allDay: true,
      completed: isTaskCompleted(task),
      objetivo: getObjetivoMeta(task, objetivos),
    };
  }

  let end = resolveTimedBlockEnd({
    tipo,
    start,
    endFromFin,
    endFromDue,
    scheduleEnd: scheduleFromNotes?.fechaFin || null,
  });

  // #region agent log
  if (typeof fetch !== 'undefined') {
    const title = String(task?.titulo || '').slice(0, 40);
    if (/yogurt|aspirar|limpiar|00:15|🫧|🚶|🥵/i.test(title)
      || (start && start.getHours() < 6)
      || (start && [8, 11].includes(start.getHours()))) {
      fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
        body: JSON.stringify({
          sessionId: 'b064c0',
          runId: 'pre-fix',
          hypothesisId: 'A',
          location: 'agendaCalendarUtils.js:taskToCalendarEvent',
          message: 'resolved calendar event times',
          data: {
            title,
            tipo,
            allDay: false,
            startH: start?.getHours(),
            startM: start?.getMinutes(),
            endH: end?.getHours(),
            endM: end?.getMinutes(),
            durMin: start && end ? (end - start) / 60000 : null,
            hasNotesSchedule: Boolean(scheduleFromNotes?.fechaInicio),
            notesStart: scheduleFromNotes?.fechaInicio?.toISOString?.() || null,
            notesEnd: scheduleFromNotes?.fechaFin?.toISOString?.() || null,
            fechaInicio: task?.fechaInicio || null,
            fechaFin: task?.fechaFin || null,
            hasTimed: Boolean(task?.googleTasksSync?.hasTimedSchedule),
            allDayFlag: allDay,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
  }
  // #endregion

  return {
    task,
    start,
    end,
    allDay: false,
    completed: isTaskCompleted(task),
    objetivo: getObjetivoMeta(task, objetivos),
  };
};

/** Duración máxima razonable para un bloque timed (evita due lejano como “fin”). */
const MAX_TIMED_BLOCK_MS = 8 * 60 * 60 * 1000;
/** Default histórico de Attadia antes de pasar a 30 min — no tratarlo como duración real. */
const LEGACY_DEFAULT_DURATION_MS = 60 * 60 * 1000;

/**
 * Resuelve el fin del bloque en grilla.
 * TAREA: no usar fechaVencimiento (due) como duración; ignorar el legacy de 60 min.
 */
export const resolveTimedBlockEnd = ({
  tipo,
  start,
  endFromFin,
  endFromDue,
  scheduleEnd = null,
}) => {
  if (!start) return null;

  const durationMs = (end) => end.getTime() - start.getTime();

  const isSensibleTimedEnd = (end) => {
    if (!end || !(end instanceof Date) || Number.isNaN(end.getTime())) return false;
    if (end <= start) return false;
    if (!isSameDay(end, start)) return false;
    const dur = durationMs(end);
    return dur >= 5 * 60 * 1000 && dur <= MAX_TIMED_BLOCK_MS;
  };

  /** 60 min exactos = default viejo, no una duración elegida. */
  const isLegacyHourDefault = (end) => (
    isSensibleTimedEnd(end) && durationMs(end) === LEGACY_DEFAULT_DURATION_MS
  );

  const pickNonLegacy = (end) => {
    if (!isSensibleTimedEnd(end)) return null;
    if (isLegacyHourDefault(end)) return null;
    return end;
  };

  if (tipo === 'EVENTO') {
    if (isSensibleTimedEnd(scheduleEnd)) return scheduleEnd;
    if (isSensibleTimedEnd(endFromFin)) return endFromFin;
    if (isSensibleTimedEnd(endFromDue)) return endFromDue;
    return addMinutes(start, DEFAULT_DURATION_MINUTES);
  }

  // TAREA: la UI es pill de 30 min. No usar fechaFin/due inflados (p. ej. residuos de drag).
  const fromNotes = pickNonLegacy(scheduleEnd);
  if (fromNotes && durationMs(fromNotes) <= 60 * 60 * 1000) return fromNotes;

  const fromFin = pickNonLegacy(endFromFin);
  if (fromFin && durationMs(fromFin) <= 60 * 60 * 1000) return fromFin;

  return addMinutes(start, DEFAULT_DURATION_MINUTES);
};

export const eventsOverlapRange = (event, rangeStart, rangeEnd) =>
  event.start < rangeEnd && event.end > rangeStart;

const pickPreferredCalendarEvent = (current, candidate) => {
  const cur = current.task;
  const cand = candidate.task;
  // Preferir evento de Google Calendar sobre task/local con misma clave
  const candCal = Boolean(cand?.googleCalendarSync?.googleEventId);
  const curCal = Boolean(cur?.googleCalendarSync?.googleEventId);
  if (candCal && !curCal) return candidate;
  if (curCal && !candCal) return current;
  if (cand.googleTasksSync?.googleTaskId && !cur.googleTasksSync?.googleTaskId) {
    return candidate;
  }
  if (cur.googleTasksSync?.googleTaskId && !cand.googleTasksSync?.googleTaskId) {
    return current;
  }
  if (!cand.virtual && cur.virtual) return candidate;
  if (cand.virtual && !cur.virtual) return current;
  return current;
};

const calendarOccurrenceKey = (ev) => {
  const task = ev.task;
  const day = calendarDayKey(ev.start);
  const gcalId = task?.googleCalendarSync?.googleEventId;
  if (gcalId) {
    const calId = task.googleCalendarSync?.googleCalendarId || '';
    return `gcal:${calId}:${gcalId}|${day}`;
  }
  const sid = String(task?.serieId?._id ?? task?.serieId ?? '');
  if (sid) return `s:${sid}|${day}`;
  const gtid = task?.googleTasksSync?.googleTaskId;
  if (gtid) return `g:${gtid}|${day}`;
  const oid = String(task?.objetivo?._id ?? task?.objetivo ?? '');
  const title = String(task?.titulo || '').trim().toLowerCase().slice(0, 80);
  if (title) return `t:${oid}|${day}|${title}`;
  return String(task?._id ?? task?.id ?? '');
};

/** Una ocurrencia visible por serie/día, Google task/día o título/día. */
export const dedupeCalendarEventsByOccurrence = (events = []) => {
  const byKey = new Map();

  for (const ev of events) {
    const key = calendarOccurrenceKey(ev);
    if (!key) continue;
    const prev = byKey.get(key);
    byKey.set(key, prev ? pickPreferredCalendarEvent(prev, ev) : ev);
  }

  return [...byKey.values()];
};

export const filterTasksInRange = (tasks, rangeStart, rangeEnd, objetivos = []) => {
  const list = normalizeTaskList(Array.isArray(tasks) ? tasks : []);
  const events = [];
  const seen = new Set();

  for (const t of list) {
    const ev = taskToCalendarEvent(t, objetivos);
    if (!ev || !eventsOverlapRange(ev, rangeStart, rangeEnd)) continue;
    const id = String(t._id ?? t.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    events.push(ev);
  }

  return dedupeCalendarEventsByOccurrence(events);
};

export const splitEventsByDay = (events, day) => {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return events.filter((ev) => {
    if (!eventsOverlapRange(ev, dayStart, dayEnd)) return false;
    const tipo = String(ev.task?.tipo || 'TAREA').toUpperCase();
    if (!ev.allDay && tipo !== 'EVENTO') {
      return isSameDay(ev.start, day);
    }
    return true;
  });
};

/**
 * Timed blocks wholly before DAY_START_HOUR must not clamp to 6:00 in the grid
 * (looks like morning + stacked ≈ 60 min). Route them to the all-day lane instead.
 */
export const isEntirelyBeforeTimedGrid = (event) => {
  if (!event?.start || event.allDay) return false;
  const end = event.end instanceof Date && !Number.isNaN(event.end.getTime())
    ? event.end
    : event.start;
  const gridStart = new Date(event.start);
  gridStart.setHours(DAY_START_HOUR, 0, 0, 0);
  return end.getTime() <= gridStart.getTime();
};

export const eventBelongsInAllDayLane = (event) =>
  Boolean(event?.allDay) || isEntirelyBeforeTimedGrid(event);

/**
 * Reparte eventos solapados: EVENTO en columnas; TAREA como bars compactas encima.
 * Las TAREA se pintan después (y con z-index mayor) para no quedar bajo Guia/etc.
 */
export const layoutTimedEventsForDay = (events = []) => {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const tasks = sorted.filter((ev) => String(ev.task?.tipo || 'TAREA').toUpperCase() !== 'EVENTO');
  const eventos = sorted.filter((ev) => String(ev.task?.tipo || 'TAREA').toUpperCase() === 'EVENTO');

  const taskItems = layoutCompactTaskBars(tasks);
  const eventoItems = layoutColumnEvents(eventos);

  return {
    // EVENTOs primero en el DOM; TAREA encima (paridad Google Calendar)
    items: [...eventoItems.items, ...taskItems.items],
    hiddenCount: taskItems.hiddenCount + eventoItems.hiddenCount,
  };
};

const layoutColumnEvents = (events = []) => {
  const columnEnds = [];
  const placed = [];

  for (const event of events) {
    const startMs = event.start.getTime();
    const endMs = event.end.getTime();
    let column = columnEnds.findIndex((end) => end <= startMs);
    if (column === -1) {
      if (columnEnds.length >= MAX_OVERLAP_COLUMNS) {
        column = MAX_OVERLAP_COLUMNS - 1;
        columnEnds[column] = Math.max(columnEnds[column], endMs);
      } else {
        column = columnEnds.length;
        columnEnds.push(endMs);
      }
    } else {
      columnEnds[column] = Math.max(columnEnds[column], endMs);
    }
    placed.push({ event, column });
  }

  const totalColumns = Math.min(
    Math.max(1, columnEnds.length),
    MAX_OVERLAP_COLUMNS,
  );
  const gapPx = 3;
  // Dejar franja izquierda para pills de TAREA (estilo Google Calendar)
  const taskGutterPct = 4;

  const items = placed.map(({ event, column }) => {
    const pos = getTimedPositionPx(event.start, event.end);
    const widthPct = (100 - taskGutterPct) / totalColumns;
    const leftPct = taskGutterPct + column * widthPct;
    return {
      event,
      layer: 'evento',
      style: {
        top: pos.top,
        height: pos.height,
        left: `calc(${leftPct}% + ${gapPx}px)`,
        width: `calc(${widthPct}% - ${gapPx * 2}px)`,
      },
    };
  });

  return { items, hiddenCount: 0 };
};

const layoutCompactTaskBars = (events = []) => {
  const gapPx = 2;
  const pillH = TASK_PILL_HEIGHT_PX;
  const columnEnds = [];
  const placed = [];
  let hiddenCount = 0;

  for (const event of events) {
    const startMs = event.start.getTime();
    const endMs = event.end.getTime();
    let column = columnEnds.findIndex((end) => end <= startMs);
    if (column === -1) {
      if (columnEnds.length >= MAX_OVERLAP_COLUMNS) {
        hiddenCount += 1;
        continue;
      }
      column = columnEnds.length;
      columnEnds.push(endMs);
    } else {
      columnEnds[column] = Math.max(columnEnds[column], endMs);
    }
    placed.push({ event, column });
  }

  const items = placed.map(({ event, column }) => {
    const startMs = event.start.getTime();
    const endMs = event.end.getTime();
    // Ancho según cuántas TAREA se solapan con ESTA (no el máx. del día entero).
    const peers = placed.filter(
      (p) => p.event.start.getTime() < endMs && p.event.end.getTime() > startMs,
    );
    const colsInGroup = Math.max(1, ...peers.map((p) => p.column + 1));
    const widthPct = 100 / colsInGroup;
    const leftPct = column * widthPct;
    const pos = getTimedPositionPx(event.start, event.end);
    const topPx = parseFloat(pos.top);

    const style = {
      top: `${topPx}px`,
      height: `${pillH}px`,
      left: `calc(${leftPct}% + ${gapPx}px)`,
      width: `calc(${widthPct}% - ${gapPx * 2}px)`,
    };

    // #region agent log
    if (typeof fetch !== 'undefined') {
      const title = String(event.task?.titulo || '').slice(0, 40);
      if (/yogurt|aspirar|limpiar/i.test(title) || column > 0 || colsInGroup > 1) {
        fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
          body: JSON.stringify({
            sessionId: 'b064c0',
            runId: 'post-fix',
            hypothesisId: 'G',
            location: 'agendaCalendarUtils.js:layoutCompactTaskBars',
            message: 'task bar column layout',
            data: {
              title,
              pillH,
              column,
              colsInGroup,
              styleWidth: style.width,
              styleHeight: style.height,
              startH: event.start?.getHours(),
              startM: event.start?.getMinutes(),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
    }
    // #endregion

    return {
      event,
      layer: 'tarea',
      stackIndex: column,
      style,
    };
  });

  return { items, hiddenCount };
};

/** Posición en % (tests / callers legacy). */
export const getTimedPosition = (start, end) => {
  const totalMinutes = getTotalGridMinutes();
  const { startMins, endMins } = getTimedStartEndMinutes(start, end, { snap: true });
  const topPct = (startMins / totalMinutes) * 100;
  const heightPct = Math.max(
    ((endMins - startMins) / totalMinutes) * 100,
    (MIN_EVENT_HEIGHT_PX / getGridHeightPx()) * 100,
  );
  return { top: `${topPct}%`, height: `${heightPct}%` };
};

/** Posición en px — minutos exactos (sin snap de display; el DnD sigue snap 30). */
export const getTimedPositionPx = (start, end) => {
  const { startMins, endMins } = getTimedStartEndMinutes(start, end, { snap: false });
  const top = (startMins / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX;
  const height = Math.max(
    ((endMins - startMins) / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX,
    MIN_EVENT_HEIGHT_PX,
  );
  return { top: `${top}px`, height: `${height}px` };
};

const getTimedStartEndMinutes = (start, end, { snap = false } = {}) => {
  const totalMinutes = getTotalGridMinutes();
  const snapFn = (mins) => Math.round(mins / SLOT_MINUTES) * SLOT_MINUTES;
  const clamp = (mins) => Math.max(0, Math.min(totalMinutes, mins));

  const rawStart = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes()
    + (start.getSeconds() / 60);
  const rawEnd = (end.getHours() - DAY_START_HOUR) * 60 + end.getMinutes()
    + (end.getSeconds() / 60);

  const startMins = clamp(snap ? snapFn(rawStart) : rawStart);
  let endMins = clamp(snap ? snapFn(rawEnd) : rawEnd);
  if (endMins <= startMins) {
    endMins = Math.min(totalMinutes, startMins + DEFAULT_DURATION_MINUTES);
  }

  // #region agent log
  if (typeof fetch !== 'undefined' && !snap && (rawStart < 0 || start.getMinutes() === 45 || start.getMinutes() === 30 || start.getHours() < 6)) {
    fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
      body: JSON.stringify({
        sessionId: 'b064c0',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'agendaCalendarUtils.js:getTimedStartEndMinutes',
        message: 'minute math',
        data: {
          h: start.getHours(),
          m: start.getMinutes(),
          rawStart,
          startMins,
          rawEnd,
          endMins,
          clampedPreGrid: rawStart < 0,
          snap,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  return { startMins, endMins };
};

export const clampEventToDay = (event, day) => {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  let start = event.start < dayStart ? dayStart : event.start;
  let end = event.end > dayEnd ? dayEnd : event.end;
  if (end <= start) {
    end = addMinutes(start, DEFAULT_DURATION_MINUTES);
  }
  return { ...event, start, end };
};

export const formatHourLabel = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

export const isEventOnDay = (event, day) => isSameDay(event.start, day) || eventsOverlapRange(event, startOfDay(day), endOfDay(day));
