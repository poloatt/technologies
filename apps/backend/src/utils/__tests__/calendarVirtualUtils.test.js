import { jest } from '@jest/globals';
import {
  buildVirtualTasksForRange,
  dedupeAgendaTasksByGoogleDay,
  dedupeSerieInstancesForAgenda,
} from '../calendarVirtualUtils.js';

describe('dedupeSerieInstancesForAgenda', () => {
  test('keeps one materialized instance per serie and day when there is no Google anchor', () => {
    const day = new Date(2026, 4, 19, 12, 0, 0, 0);
    const tasks = [
      {
        _id: 'a1',
        serieId: 'serie-1',
        fechaInicio: day,
        fechaVencimiento: day,
        googleTasksSync: {},
      },
      {
        _id: 'a2',
        serieId: 'serie-1',
        fechaInicio: day,
        fechaVencimiento: day,
        googleTasksSync: {},
      },
    ];

    const deduped = dedupeSerieInstancesForAgenda(tasks);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]._id).toBe('a1');
  });

  test('keeps the Google anchor and a later occurrence on another day', () => {
    const doneDay = new Date(2026, 8, 20, 0, 15, 0, 0);
    const nextDay = new Date(2026, 8, 27, 0, 15, 0, 0);
    const tasks = [
      {
        _id: 'anchor',
        serieId: 'serie-1',
        fechaInicio: doneDay,
        fechaVencimiento: doneDay,
        completada: true,
        estado: 'COMPLETADA',
        googleTasksSync: { googleTaskId: 'gt-1' },
      },
      {
        _id: 'next',
        serieId: 'serie-1',
        fechaInicio: nextDay,
        fechaVencimiento: nextDay,
        completada: false,
        estado: 'PENDIENTE',
        googleTasksSync: { localOccurrence: true },
      },
    ];

    const deduped = dedupeSerieInstancesForAgenda(tasks);
    expect(deduped.map((t) => t._id).sort()).toEqual(['anchor', 'next']);
  });

  test('same day prefers the real clock over a 00:15 Google anchor', () => {
    const day = new Date(2026, 8, 23, 0, 15, 0, 0);
    const real = new Date(2026, 8, 23, 17, 45, 0, 0);
    const realEnd = new Date(2026, 8, 23, 18, 15, 0, 0);
    const tasks = [
      {
        _id: 'anchor',
        serieId: 'serie-1',
        fechaInicio: day,
        fechaVencimiento: day,
        googleTasksSync: { googleTaskId: 'gt-1' },
      },
      {
        _id: 'timed',
        serieId: 'serie-1',
        fechaInicio: real,
        fechaFin: realEnd,
        fechaVencimiento: realEnd,
        googleTasksSync: {},
      },
    ];
    const deduped = dedupeSerieInstancesForAgenda(tasks);
    expect(deduped.map((t) => t._id)).toEqual(['timed']);
  });
});

describe('dedupeAgendaTasksByGoogleDay', () => {
  test('drops duplicate rows with same googleTaskId on the same day', () => {
    const day = new Date(2026, 4, 20, 12, 0, 0, 0);
    const tasks = [
      {
        _id: 't1',
        fechaVencimiento: day,
        googleTasksSync: { googleTaskId: 'gt-dup' },
      },
      {
        _id: 't2',
        fechaVencimiento: day,
        googleTasksSync: { googleTaskId: 'gt-dup' },
      },
    ];
    expect(dedupeAgendaTasksByGoogleDay(tasks)).toHaveLength(1);
  });
});

describe('buildVirtualTasksForRange', () => {
  test('Attadia-local series expand virtual occurrences with wall-clock time', () => {
    const dtstart = new Date(2025, 4, 12, 9, 30, 0, 0);
    const series = [
      {
        _id: 'serie1',
        titulo: 'Weekly standup',
        usuario: 'u1',
        objetivo: 'obj1',
        activa: true,
        rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
        dtstart,
        googleTasksSync: { exportInstances: true, googleTaskListId: 'list1' },
      },
    ];

    const from = new Date(2025, 4, 1);
    const to = new Date(2025, 5, 1);

    const virtual = buildVirtualTasksForRange(series, from, to, []);

    expect(virtual.length).toBeGreaterThan(0);
    for (const v of virtual) {
      const start = v.fechaInicio instanceof Date ? v.fechaInicio : new Date(v.fechaInicio);
      expect(start.getHours()).toBe(9);
      expect(start.getMinutes()).toBe(30);
      expect(typeof v.fechaInicio).not.toBe('string');
    }
  });

  test('Google-origin series do not paint virtual weeks over the visible range', () => {
    const dtstart = new Date(2026, 4, 14, 12, 0, 0, 0);
    const series = [
      {
        _id: 'serie-we',
        titulo: 'Neurología',
        usuario: 'u1',
        objetivo: 'obj-atta',
        activa: true,
        rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
        dtstart,
        googleSerieKey: 'list-atta|neurologia',
        googleTasksSync: { exportInstances: false, googleTaskListId: 'list-atta' },
      },
    ];

    const from = new Date(2026, 4, 1);
    const to = new Date(2026, 5, 1);
    const anchorDay = new Date(2026, 4, 18, 14, 0, 0, 0);

    const existingTasks = [
      {
        _id: 'anchor1',
        serieId: 'serie-we',
        fechaVencimiento: anchorDay,
        fechaInicio: anchorDay,
        googleTasksSync: { googleTaskId: 'gt-1' },
      },
    ];

    const virtual = buildVirtualTasksForRange(series, from, to, existingTasks);
    expect(virtual).toHaveLength(0);
  });

  test('skips all virtual occurrences when Google anchor is completed', () => {
    const dtstart = new Date(2026, 4, 14, 12, 0, 0, 0);
    const series = [
      {
        _id: 'serie-done',
        titulo: 'Done habit',
        usuario: 'u1',
        objetivo: 'obj1',
        activa: true,
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstart,
        googleTasksSync: { googleTaskListId: 'list1' },
      },
    ];
    const from = new Date(2026, 4, 1);
    const to = new Date(2026, 5, 1);
    const anchorDay = new Date(2026, 4, 20, 12, 0, 0, 0);
    const existingTasks = [
      {
        _id: 'anchor-done',
        serieId: 'serie-done',
        fechaVencimiento: anchorDay,
        fechaInicio: anchorDay,
        estado: 'COMPLETADA',
        completada: true,
        googleTasksSync: { googleTaskId: 'gt-done', completed: anchorDay },
      },
    ];

    const virtual = buildVirtualTasksForRange(series, from, to, existingTasks);
    expect(virtual).toHaveLength(0);
  });

  test('skips virtuals when completed Google anchor is outside range but passed externally', () => {
    const dtstart = new Date(2024, 0, 8, 12, 0, 0, 0);
    const series = [
      {
        _id: 'serie-old',
        titulo: 'Old weekly',
        usuario: 'u1',
        objetivo: 'obj1',
        activa: true,
        rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
        dtstart,
        googleSerieKey: 'list1|old weekly',
        googleTasksSync: { googleTaskListId: 'list1' },
      },
    ];
    const from = new Date(2026, 5, 15);
    const to = new Date(2026, 5, 21, 23, 59, 59, 999);
    const externalAnchors = new Map([
      ['serie-old', {
        _id: 'anchor-old',
        serieId: 'serie-old',
        estado: 'COMPLETADA',
        completada: true,
        fechaVencimiento: new Date(2024, 2, 10, 12, 0, 0, 0),
        googleTasksSync: { googleTaskId: 'gt-old', completed: new Date(2024, 2, 10) },
      }],
    ]);

    const virtual = buildVirtualTasksForRange(series, from, to, [], externalAnchors);
    expect(virtual).toHaveLength(0);
  });

  test('skips Google-origin series without any anchor in DB', () => {
    const series = [
      {
        _id: 'serie-no-anchor',
        titulo: 'Ghost',
        activa: true,
        rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
        dtstart: new Date(2026, 0, 5, 12, 0, 0, 0),
        googleSerieKey: 'list1|ghost',
        googleTasksSync: { googleTaskListId: 'list1' },
      },
    ];
    const from = new Date(2026, 5, 15);
    const to = new Date(2026, 5, 21, 23, 59, 59, 999);
    expect(buildVirtualTasksForRange(series, from, to, [])).toHaveLength(0);
  });
});
