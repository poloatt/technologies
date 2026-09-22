import {
  appendScheduleToNotes,
  parseScheduleFromNotes,
  stripScheduleFromNotes,
  taskHasTimedSchedule,
} from '../../../../shared/utils/googleTasksScheduleNotes.js';

describe('googleTasksScheduleNotes', () => {
  test('round-trip schedule block in notes', () => {
    const start = new Date(2026, 5, 16, 14, 0, 0, 0);
    const end = new Date(2026, 5, 16, 14, 45, 0, 0);
    const notes = appendScheduleToNotes('Mi tarea', start, end);
    const parsed = parseScheduleFromNotes(notes);
    expect(parsed.fechaInicio.getHours()).toBe(14);
    expect(parsed.fechaFin.getMinutes()).toBe(45);
    expect(stripScheduleFromNotes(notes)).toBe('Mi tarea');
  });

  test('parseScheduleFromNotes heals legacy 60-min blocks to 30', () => {
    const start = new Date(2026, 5, 16, 14, 0, 0, 0);
    const end = new Date(2026, 5, 16, 15, 0, 0, 0);
    const notes = appendScheduleToNotes('Mi tarea', start, end);
    const parsed = parseScheduleFromNotes(notes);
    expect(parsed.fechaFin.getTime() - parsed.fechaInicio.getTime()).toBe(30 * 60 * 1000);
  });

  test('taskHasTimedSchedule detects notes block and local wall-clock', () => {
    const start = new Date(2026, 5, 16, 7, 45, 0, 0);
    const end = new Date(2026, 5, 16, 8, 15, 0, 0);
    const notes = appendScheduleToNotes('', start, end);
    expect(taskHasTimedSchedule({
      descripcion: notes,
      googleTasksSync: { googleTaskId: 'gt-1' },
    })).toBe(true);

    expect(taskHasTimedSchedule({
      fechaInicio: start,
      fechaVencimiento: end,
      googleTasksSync: { googleTaskId: 'gt-2' },
    })).toBe(true);

    expect(taskHasTimedSchedule({
      fechaInicio: new Date(2026, 5, 16, 12, 0, 0, 0),
      fechaVencimiento: new Date(2026, 5, 16, 12, 0, 0, 0),
      googleTasksSync: { googleTaskId: 'gt-3' },
    })).toBe(false);
  });
});
