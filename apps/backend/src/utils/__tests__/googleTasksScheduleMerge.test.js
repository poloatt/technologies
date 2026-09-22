import { mergeGoogleDueWithLocalSchedule } from '../googleTasksScheduleMerge.js';

describe('mergeGoogleDueWithLocalSchedule', () => {
  test('preserves local wall-clock when Google due day changes', () => {
    const tarea = {
      fechaInicio: new Date(2026, 5, 10, 7, 45, 0, 0),
      fechaVencimiento: new Date(2026, 5, 10, 8, 15, 0, 0),
      googleTasksSync: { hasTimedSchedule: true },
    };

    mergeGoogleDueWithLocalSchedule(tarea, '2026-06-16T00:00:00.000Z');

    expect(tarea.fechaInicio.getDate()).toBe(16);
    expect(tarea.fechaInicio.getHours()).toBe(7);
    expect(tarea.fechaInicio.getMinutes()).toBe(45);
    expect(tarea.googleTasksSync.hasTimedSchedule).toBe(true);
  });

  test('preserves timed schedule when notes schedule block present', () => {
    const tarea = {
      fechaInicio: new Date(2026, 5, 10, 9, 0, 0, 0),
      fechaVencimiento: new Date(2026, 5, 10, 10, 0, 0, 0),
      descripcion: 'Horario Attadia:\ninicio: 2026-06-10T12:00:00.000Z\nfin: 2026-06-10T13:00:00.000Z',
      googleTasksSync: { hasTimedSchedule: true },
    };

    mergeGoogleDueWithLocalSchedule(tarea, '2026-06-20T00:00:00.000Z');

    expect(tarea.fechaInicio.getUTCHours()).toBe(12);
    expect(tarea.googleTasksSync.hasTimedSchedule).toBe(true);
  });

  test('date-only Google due sets noon local start/end', () => {
    const tarea = {
      fechaInicio: null,
      fechaVencimiento: null,
      googleTasksSync: {},
    };

    mergeGoogleDueWithLocalSchedule(tarea, '2026-06-16T00:00:00.000Z');

    expect(tarea.fechaInicio.getHours()).toBe(12);
    expect(tarea.fechaVencimiento.getHours()).toBe(12);
    expect(tarea.googleTasksSync.hasTimedSchedule).toBeFalsy();
  });
});
