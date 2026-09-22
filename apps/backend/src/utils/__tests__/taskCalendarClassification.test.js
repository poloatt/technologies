import {
  isAllDayTask,
  taskToCalendarEvent,
  layoutTimedEventsForDay,
  dedupeCalendarEventsByOccurrence,
  getTimedPositionPx,
  isEntirelyBeforeTimedGrid,
  eventBelongsInAllDayLane,
} from '../../../../shared/utils/calendar/agendaCalendarUtils.js';
import { HALF_SLOT_HEIGHT_PX, TASK_PILL_HEIGHT_PX } from '../../../../shared/utils/calendar/calendarLayout.js';

describe('task calendar classification', () => {
  test('timed TAREA does not use long same-day due as block duration', () => {
    const start = new Date(2026, 5, 16, 9, 15, 0, 0);
    const dueEvening = new Date(2026, 5, 16, 18, 0, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Yogurt',
      fechaInicio: start,
      fechaVencimiento: dueEvening,
      googleTasksSync: { hasTimedSchedule: true, googleTaskId: 'gt-y' },
    };
    expect(isAllDayTask(task)).toBe(false);
    const ev = taskToCalendarEvent(task, []);
    expect(ev.allDay).toBe(false);
    expect(ev.start.getHours()).toBe(9);
    expect(ev.start.getMinutes()).toBe(15);
    // Default 30 min — not 18:00 due
    expect(ev.end.getHours()).toBe(9);
    expect(ev.end.getMinutes()).toBe(45);
  });

  test('timed TAREA remaps legacy 60-min fechaFin / notes to 30 min', () => {
    const start = new Date(2026, 5, 16, 10, 0, 0, 0);
    const finLegacy = new Date(2026, 5, 16, 11, 0, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Call',
      fechaInicio: start,
      fechaFin: finLegacy,
      fechaVencimiento: finLegacy,
      descripcion: 'Horario Attadia:\ninicio: 2026-06-16T13:00:00.000Z\nfin: 2026-06-16T14:00:00.000Z',
      googleTasksSync: { hasTimedSchedule: true },
    };
    const ev = taskToCalendarEvent(task, []);
    expect(ev.end.getTime() - ev.start.getTime()).toBe(30 * 60 * 1000);
  });

  test('timed TAREA keeps non-legacy durations (e.g. 45 min)', () => {
    const start = new Date(2026, 5, 16, 10, 0, 0, 0);
    const fin = new Date(2026, 5, 16, 10, 45, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Deep work',
      fechaInicio: start,
      fechaFin: fin,
      googleTasksSync: { hasTimedSchedule: true },
    };
    const ev = taskToCalendarEvent(task, []);
    expect(ev.end.getTime() - ev.start.getTime()).toBe(45 * 60 * 1000);
  });

  test('timed TAREA ignores 1h due as block end', () => {
    const start = new Date(2026, 5, 16, 9, 0, 0, 0);
    const due1h = new Date(2026, 5, 16, 10, 0, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Short',
      fechaInicio: start,
      fechaVencimiento: due1h,
      googleTasksSync: { hasTimedSchedule: true },
    };
    const ev = taskToCalendarEvent(task, []);
    expect(ev.end.getTime() - ev.start.getTime()).toBe(30 * 60 * 1000);
  });

  test('TAREA with inflated fechaFin still resolves to 30 min block', () => {
    const start = new Date(2026, 8, 22, 17, 15, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Aspirar',
      fechaInicio: start,
      fechaFin: new Date(2026, 8, 22, 23, 29, 0, 0),
      googleTasksSync: { googleTaskId: 'gt-1', hasTimedSchedule: true },
    };
    const ev = taskToCalendarEvent(task, []);
    expect(ev.allDay).toBe(false);
    expect(ev.end.getTime() - ev.start.getTime()).toBe(30 * 60 * 1000);
  });

  test('Google date-only task without timed schedule is all-day', () => {
    const task = {
      tipo: 'TAREA',
      titulo: 'Due Google',
      fechaVencimiento: new Date(2026, 5, 16, 12, 0, 0, 0),
      fechaInicio: new Date(2026, 5, 16, 12, 0, 0, 0),
      googleTasksSync: { googleTaskId: 'gt-1' },
    };
    expect(isAllDayTask(task)).toBe(true);
    const ev = taskToCalendarEvent(task, []);
    expect(ev.allDay).toBe(true);
  });

  test('timed TAREA wholly before DAY_START routes to all-day lane', () => {
    const start = new Date(2026, 8, 22, 0, 15, 0, 0);
    const end = new Date(2026, 8, 22, 0, 45, 0, 0);
    const event = {
      task: { tipo: 'TAREA', titulo: 'Early' },
      start,
      end,
      allDay: false,
    };
    expect(isEntirelyBeforeTimedGrid(event)).toBe(true);
    expect(eventBelongsInAllDayLane(event)).toBe(true);
    expect(eventBelongsInAllDayLane({
      ...event,
      start: new Date(2026, 8, 22, 8, 45, 0, 0),
      end: new Date(2026, 8, 22, 9, 15, 0, 0),
    })).toBe(false);
  });

  test('Google Calendar allDay flag forces all-day lane despite UTC noon', () => {
    const task = {
      tipo: 'EVENTO',
      titulo: 'Feriado',
      fechaInicio: new Date(Date.UTC(2026, 5, 21, 12, 0, 0, 0)),
      fechaFin: new Date(Date.UTC(2026, 5, 21, 23, 59, 59, 999)),
      googleCalendarSync: { googleEventId: 'evt-ad', allDay: true },
    };
    expect(isAllDayTask(task)).toBe(true);
    const ev = taskToCalendarEvent(task, []);
    expect(ev.allDay).toBe(true);
    expect(ev.start.getHours()).toBe(0);
    expect(ev.start.getDate()).toBe(21);
  });

  test('task with hasTimedSchedule is not all-day', () => {
    const start = new Date(2026, 5, 16, 14, 0, 0, 0);
    const end = new Date(2026, 5, 16, 15, 0, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Timed',
      fechaInicio: start,
      fechaFin: end,
      fechaVencimiento: end,
      googleTasksSync: { googleTaskId: 'gt-2', hasTimedSchedule: true },
    };
    expect(isAllDayTask(task)).toBe(false);
    const ev = taskToCalendarEvent(task, []);
    expect(ev.allDay).toBe(false);
  });

  test('Google task with wall-clock time infers timed grid placement', () => {
    const start = new Date(2026, 5, 16, 7, 45, 0, 0);
    const end = new Date(2026, 5, 16, 8, 15, 0, 0);
    const task = {
      tipo: 'TAREA',
      titulo: 'Morning task',
      fechaInicio: start,
      fechaVencimiento: end,
      googleTasksSync: { googleTaskId: 'gt-3' },
    };
    expect(isAllDayTask(task)).toBe(false);
    const ev = taskToCalendarEvent(task, []);
    expect(ev.allDay).toBe(false);
    expect(ev.start.getHours()).toBe(7);
  });

  test('getTimedPositionPx keeps :45 without snapping to next hour', () => {
    const start = new Date(2026, 5, 16, 8, 45, 0, 0);
    const end = new Date(2026, 5, 16, 9, 15, 0, 0);
    const pos = getTimedPositionPx(start, end);
    // 8:45 = 2h45 after 6:00 → 165 min → 165/30 * 28 = 154px
    expect(pos.top).toBe('154px');
  });

  test('Google task without due date is excluded from calendar', () => {
    const task = {
      tipo: 'TAREA',
      titulo: 'Inbox',
      googleTasksSync: { googleTaskId: 'gt-4' },
    };
    expect(taskToCalendarEvent(task, [])).toBeNull();
  });

  test('layoutTimedEventsForDay paints tasks above events with compact pill height', () => {
    const start = new Date(2026, 5, 16, 14, 0, 0, 0);
    const end = new Date(2026, 5, 16, 14, 30, 0, 0);
    const events = [
      { task: { tipo: 'EVENTO', _id: 'e' }, start, end: new Date(2026, 5, 16, 17, 0, 0, 0), allDay: false },
      { task: { tipo: 'TAREA', _id: 'a' }, start, end, allDay: false },
      { task: { tipo: 'TAREA', _id: 'b' }, start, end, allDay: false },
    ];
    const { items } = layoutTimedEventsForDay(events);
    expect(items).toHaveLength(3);
    expect(items[0].layer).toBe('evento');
    expect(items[1].layer).toBe('tarea');
    expect(items[2].layer).toBe('tarea');
    expect(items[1].style.height).toBe(`${TASK_PILL_HEIGHT_PX}px`);
    expect(items[1].style.height).toBe(`${HALF_SLOT_HEIGHT_PX}px`);
    // Solapes en columnas (misma top); Yogurt solo → ancho completo en otro test implícito
    expect(items[1].style.top).toBe(items[2].style.top);
    expect(items[1].style.left).not.toBe(items[2].style.left);
    expect(items[1].style.width).toContain('50%');

    const solo = layoutTimedEventsForDay([
      { task: { tipo: 'TAREA', _id: 'solo' }, start, end, allDay: false },
    ]);
    expect(solo.items[0].style.width).toContain('100%');
  });

  test('dedupe keeps Google Calendar EVENTO alongside same-title Google Task', () => {
    const day = new Date(2026, 5, 16, 0, 0, 0, 0);
    const events = [
      {
        task: {
          _id: 'task-1',
          tipo: 'TAREA',
          titulo: 'Dentista',
          googleTasksSync: { googleTaskId: 'gt-1' },
        },
        start: day,
        end: new Date(2026, 5, 16, 23, 59, 59),
        allDay: true,
      },
      {
        task: {
          _id: 'evt-1',
          tipo: 'EVENTO',
          titulo: 'Dentista',
          googleCalendarSync: { googleEventId: 'cal-1', googleCalendarId: 'primary' },
        },
        start: day,
        end: new Date(2026, 5, 16, 23, 59, 59),
        allDay: true,
      },
    ];
    const deduped = dedupeCalendarEventsByOccurrence(events);
    expect(deduped).toHaveLength(2);
  });
});
