import {
  getDefaultListRange,
  filterDocsForListView,
} from '../tareasAgendaUtils.js';
import { isInAhora, isInLuego } from '../agendaListRules.js';

describe('getDefaultListRange', () => {
  test('returns bounded window around today', () => {
    const { from, to } = getDefaultListRange();
    const days = (to - from) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(90);
    expect(days).toBeLessThan(150);
  });
});

describe('filterDocsForListView', () => {
  test('filters by view using agenda rules', () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 2);
    tomorrow.setHours(12, 0, 0, 0);

    const mockDocs = [
      { _id: '1', titulo: 'Hoy', fechaVencimiento: now, estado: 'PENDIENTE' },
      { _id: '2', titulo: 'Futuro', fechaVencimiento: tomorrow, estado: 'PENDIENTE' },
    ];

    const ahora = filterDocsForListView(mockDocs, { view: 'ahora', includeCompleted: true }, now);
    const luego = filterDocsForListView(mockDocs, { view: 'luego', includeCompleted: true }, now);

    expect(ahora.some((t) => t.titulo === 'Hoy')).toBe(true);
    expect(luego.some((t) => t.titulo === 'Futuro')).toBe(true);
    expect(isInAhora(mockDocs[0])).toBe(true);
    expect(isInLuego(mockDocs[1])).toBe(true);
  });

  test('excludes completed tasks when includeCompleted is false', () => {
    const now = new Date();
    const docs = [
      { _id: '1', titulo: 'Done', fechaVencimiento: now, estado: 'COMPLETADA', completada: true },
      { _id: '2', titulo: 'Open', fechaVencimiento: now, estado: 'PENDIENTE' },
    ];
    const filtered = filterDocsForListView(docs, { view: 'ahora' }, now);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].titulo).toBe('Open');
  });

  test('excludes completed via googleTasksSync.completed only', () => {
    const now = new Date();
    const docs = [
      {
        _id: '1',
        titulo: 'Google done',
        fechaVencimiento: now,
        estado: 'PENDIENTE',
        completada: false,
        googleTasksSync: { completed: '2026-05-01T10:00:00.000Z' },
      },
      { _id: '2', titulo: 'Open', fechaVencimiento: now, estado: 'PENDIENTE' },
    ];
    const filtered = filterDocsForListView(docs, { view: 'ahora' }, now);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].titulo).toBe('Open');
  });

  test('always excludes CANCELADA from list views', () => {
    const now = new Date();
    const docs = [
      { _id: '1', titulo: 'Cancelled', fechaVencimiento: now, estado: 'CANCELADA', completada: false },
      { _id: '2', titulo: 'Open', fechaVencimiento: now, estado: 'PENDIENTE' },
    ];
    const filtered = filterDocsForListView(docs, { view: 'ahora', includeCompleted: true }, now);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].titulo).toBe('Open');
  });
});
