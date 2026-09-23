import { parseISO, startOfDay } from 'date-fns';
import {
  allDayDropId,
  applyAllDayMoveToTask,
  applyTimedMoveToTask,
  computeAllDayMove,
  computeAllDayToTimedMove,
  computeEventMove,
  deltaYToGridMinutes,
  isCalendarTaskDraggable,
  parseAllDayDropId,
  parseCalendarDropTarget,
  parseDayDropId,
} from '../../../../shared/utils/calendar/calendarDragUtils.js';
import { getTimedPosition } from '../../../../shared/utils/calendar/agendaCalendarUtils.js';
import {
  DAY_START_HOUR,
  DEFAULT_DURATION_MINUTES,
  DRAG_SNAP_MINUTES,
  getGridHeightPx,
  HALF_SLOT_HEIGHT_PX,
  SLOT_MINUTES,
} from '../../../../shared/utils/calendar/calendarLayout.js';

describe('calendar drag utils', () => {
  test('deltaYToGridMinutes snaps to 15 min slots', () => {
    const quarterSlotPx = HALF_SLOT_HEIGHT_PX / 2; // 15 min within 30-min half slot
    expect(deltaYToGridMinutes(0)).toBe(0);
    expect(deltaYToGridMinutes(quarterSlotPx)).toBe(DRAG_SNAP_MINUTES);
    expect(deltaYToGridMinutes(quarterSlotPx * 1.4)).toBe(DRAG_SNAP_MINUTES);
    expect(deltaYToGridMinutes(HALF_SLOT_HEIGHT_PX)).toBe(SLOT_MINUTES);
    expect(deltaYToGridMinutes(HALF_SLOT_HEIGHT_PX * 2)).toBe(SLOT_MINUTES * 2);
  });

  test('parseDayDropId reads day column ids', () => {
    expect(parseDayDropId('day:2026-05-18')).toEqual(startOfDay(parseISO('2026-05-18')));
    expect(parseDayDropId('ev:123')).toBeNull();
  });

  test('parseAllDayDropId and parseCalendarDropTarget', () => {
    expect(parseAllDayDropId(allDayDropId(parseISO('2026-05-18')))).toEqual(
      startOfDay(parseISO('2026-05-18')),
    );
    expect(parseCalendarDropTarget('allday:2026-05-18')).toEqual({
      day: startOfDay(parseISO('2026-05-18')),
      zone: 'allDay',
    });
    expect(parseCalendarDropTarget('day:2026-05-18')).toEqual({
      day: startOfDay(parseISO('2026-05-18')),
      zone: 'timed',
    });
  });

  test('computeEventMove for TAREA ignores inflated event.end (pill = 30 min)', () => {
    const event = {
      task: { tipo: 'TAREA', titulo: 'Aspirar' },
      start: new Date(2026, 4, 12, 17, 15, 0),
      // fin corrupto (~6h) como en el bug del preview 17:15–23:29
      end: new Date(2026, 4, 12, 23, 29, 0),
    };
    const targetDay = startOfDay(parseISO('2026-05-12'));
    const { newStart, newEnd } = computeEventMove(event, targetDay, 0);
    expect(newStart.getHours()).toBe(17);
    expect(newStart.getMinutes()).toBe(15);
    expect(newEnd.getTime() - newStart.getTime()).toBe(DEFAULT_DURATION_MINUTES * 60 * 1000);
  });

  test('computeEventMove changes day and snaps time to 15 min', () => {
    const event = {
      task: { tipo: 'TAREA' },
      start: new Date(2026, 4, 12, 14, 0, 0),
      end: new Date(2026, 4, 12, 14, 30, 0),
    };
    const targetDay = startOfDay(parseISO('2026-05-14'));
    const { newStart, newEnd, allDay } = computeEventMove(
      event,
      targetDay,
      HALF_SLOT_HEIGHT_PX / 2,
    );
    expect(allDay).toBe(false);
    expect(newStart.getFullYear()).toBe(2026);
    expect(newStart.getMonth()).toBe(4);
    expect(newStart.getDate()).toBe(14);
    expect(newStart.getHours()).toBe(14);
    expect(newStart.getMinutes()).toBe(15);
    expect(newEnd.getTime() - newStart.getTime()).toBe(30 * 60 * 1000);
  });

  test('computeAllDayToTimedMove places at relative Y', () => {
    const targetDay = startOfDay(parseISO('2026-05-14'));
    const { newStart, newEnd, allDay } = computeAllDayToTimedMove(targetDay, HALF_SLOT_HEIGHT_PX * 2);
    expect(allDay).toBe(false);
    expect(newStart.getHours()).toBe(DAY_START_HOUR + 1);
    expect(newStart.getMinutes()).toBe(0);
    expect(newEnd.getTime() - newStart.getTime()).toBe(DEFAULT_DURATION_MINUTES * 60 * 1000);
  });

  test('applyTimedMoveToTask rewrites Horario Attadia notes', () => {
    const task = {
      descripcion: 'Nota\n\nHorario Attadia:\ninicio: 2026-05-18T12:00:00.000Z\nfin: 2026-05-18T12:30:00.000Z',
      googleTasksSync: { hasTimedSchedule: true, googleTaskId: 'g1' },
    };
    const newStart = new Date(2026, 4, 18, 16, 15, 0, 0);
    const newEnd = new Date(2026, 4, 18, 16, 45, 0, 0);
    const patch = applyTimedMoveToTask(task, newStart, newEnd);
    expect(patch.fechaInicio).toEqual(newStart);
    expect(patch.descripcion).toContain('Horario Attadia:');
    expect(patch.descripcion).toContain(newStart.toISOString());
    expect(patch.descripcion).not.toContain('2026-05-18T12:00:00.000Z');
  });

  test('computeAllDayMove and applyAllDayMoveToTask clear timed schedule', () => {
    const targetDay = startOfDay(parseISO('2026-05-20'));
    const move = computeAllDayMove(targetDay);
    expect(move.allDay).toBe(true);
    expect(move.newStart.getHours()).toBe(0);

    const patch = applyAllDayMoveToTask(
      { googleTasksSync: { hasTimedSchedule: true, googleTaskId: 'g1' } },
      targetDay,
    );
    expect(patch.clearTimedSchedule).toBe(true);
    expect(patch.googleTasksSync.hasTimedSchedule).toBe(false);
    expect(patch.fechaInicio.getDate()).toBe(20);
  });

  test('isCalendarTaskDraggable blocks virtual and Google Calendar imports', () => {
    expect(isCalendarTaskDraggable({ _id: '1' })).toBe(true);
    expect(isCalendarTaskDraggable({ _id: '1', virtual: true })).toBe(false);
    expect(isCalendarTaskDraggable({
      _id: '1',
      googleCalendarSync: { googleEventId: 'evt' },
    })).toBe(false);
    expect(isCalendarTaskDraggable({ _id: '1', completada: true })).toBe(false);
  });
});

describe('getTimedPosition 30 min snap', () => {
  test('snaps start and end to 30 minute grid', () => {
    const start = new Date(2026, 4, 18, DAY_START_HOUR, 7, 0);
    const end = new Date(2026, 4, 18, DAY_START_HOUR, 38, 0);
    const pos = getTimedPosition(start, end);
    const gridHeight = getGridHeightPx();
    const topPx = (parseFloat(pos.top) / 100) * gridHeight;
    const heightPx = (parseFloat(pos.height) / 100) * gridHeight;
    expect(topPx).toBeCloseTo(0, 0);
    expect(heightPx).toBeCloseTo(HALF_SLOT_HEIGHT_PX, 0);
  });
});
