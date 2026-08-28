import googleTasksService from '../googleTasksService.js';
import { Tareas } from '../../models/Tareas.js';

describe('Tareas.parseGoogleDueDate', () => {
  test('date-only YYYY-MM-DD maps to local noon', () => {
    const d = Tareas.parseGoogleDueDate('2026-05-20');
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
  });

  test('midnight UTC is treated as date-only (local noon)', () => {
    const d = Tareas.parseGoogleDueDate('2026-05-20T00:00:00.000Z');
    expect(d.getHours()).toBe(12);
  });

  test('UTC noon marker is treated as date-only (local noon)', () => {
    const d = Tareas.parseGoogleDueDate('2026-05-20T12:00:00.000Z');
    expect(d.getHours()).toBe(12);
    expect(d.getDate()).toBe(20);
  });

  test('RFC3339 with time maps to local noon on that calendar day', () => {
    const d = Tareas.parseGoogleDueDate('2026-05-20T16:45:00.000Z');
    expect(d.getHours()).toBe(12);
    expect(d.getDate()).toBe(20);
  });

  test('formatGoogleDueDateOnly exports date-only RFC3339', () => {
    const d = new Date(2026, 4, 20, 16, 45, 0, 0);
    expect(Tareas.formatGoogleDueDateOnly(d)).toBe('2026-05-20T00:00:00.000Z');
  });
});

describe('googleTasksService helpers', () => {
  test('cleanTitle removes bracket prefixes and collapses spaces', () => {
    const cases = [
      ['[Salud] Turno dentista', 'Turno dentista'],
      ['  [Mis tareas]   Sacar   Basura  ', 'Sacar Basura'],
      ['[A][B]   X', 'X'],
      ['', 'Tarea importada']
    ];
    for (const [input, expected] of cases) {
      expect(googleTasksService.cleanTitle(input)).toBe(expected);
    }
  });

  test('normalizeTitleStrong removes diacritics and brackets, lowercase, collapse spaces', () => {
    const input = '  [Trámites]  Adjuntar   pDF  ';
    const norm = googleTasksService.normalizeTitleStrong(input);
    expect(norm).toBe('adjuntar pdf');
  });

  test('equalsForPatch matches only on relevant fields', () => {
    const remote = { title: 'Tarea', status: 'needsAction', notes: 'abc', updated: 'ignored' };
    const same = { title: 'Tarea', status: 'needsAction', notes: 'abc', parent: 'ignored' };
    const different = { title: 'Tarea!', status: 'needsAction', notes: 'abc' };
    expect(googleTasksService.equalsForPatch(remote, same)).toBe(true);
    expect(googleTasksService.equalsForPatch(remote, different)).toBe(false);
  });

  test('parseSubtasksFromNotes extracts description and subtareas with checkboxes', () => {
    const notes = `Descripción de la tarea

Subtareas:
☐ Pendiente uno
☑ Hecho dos
○ Legacy pendiente
✓ Legacy hecho`;

    const { descripcion, subtareas } = googleTasksService.parseSubtasksFromNotes(notes);
    expect(descripcion).toBe('Descripción de la tarea');
    expect(subtareas).toHaveLength(4);
    expect(subtareas[0]).toEqual({ titulo: 'Pendiente uno', completada: false });
    expect(subtareas[1]).toEqual({ titulo: 'Hecho dos', completada: true });
    expect(subtareas[2].completada).toBe(false);
    expect(subtareas[3].completada).toBe(true);
  });

  test('buildTaskNotes does not duplicate Subtareas block from descripcion', () => {
    const tarea = {
      descripcion: 'Mi descripción\n\nSubtareas:\n☐ Vieja',
      subtareas: [{ titulo: 'Nueva', completada: false }]
    };
    const notes = googleTasksService.buildTaskNotes(tarea);
    expect(notes.match(/Subtareas:/g)).toHaveLength(1);
    expect(notes).toContain('☐ Nueva');
    expect(notes).toContain('Mi descripción');
  });

  test('shouldRefreshGoogleDueDate when Google due differs from local', () => {
    const googleTask = { due: '2026-05-20T00:00:00.000Z' };
    const tarea = {
      fechaVencimiento: new Date(2026, 4, 21, 12, 0, 0, 0),
      fechaInicio: new Date(2026, 4, 21, 12, 0, 0, 0),
    };
    expect(googleTasksService.shouldRefreshGoogleDueDate(tarea, googleTask)).toBe(true);
    expect(
      googleTasksService.shouldRefreshGoogleDueDate(
        { fechaVencimiento: new Date(2026, 4, 20, 12, 0, 0, 0) },
        googleTask,
      ),
    ).toBe(false);
  });

  test('shouldRefreshGoogleNotes when Google notes carry recurrence', () => {
    const googleTask = {
      notes: 'Recordatorio\nSe repite cada semana',
    };
    const tarea = { descripcion: 'Recordatorio' };
    expect(googleTasksService.shouldRefreshGoogleNotes(tarea, googleTask)).toBe(true);
  });

  test('shouldRefreshGoogleStatus when Google completed differs from local', () => {
    const googleTask = { status: 'completed', updated: '2026-05-18T10:00:00.000Z' };
    const tarea = {
      completada: false,
      estado: 'PENDIENTE',
      googleTasksSync: { needsSync: false },
    };
    expect(googleTasksService.shouldRefreshGoogleStatus(tarea, googleTask)).toBe(true);
    expect(googleTasksService.shouldImportFromGoogle(tarea, googleTask)).toBe(true);
  });

  test('applyGoogleStatusAndDue sets completada and fecha from Google', () => {
    const tarea = new Tareas({
      titulo: 'Test',
      usuario: '507f1f77bcf86cd799439011',
      estado: 'PENDIENTE',
      completada: false,
    });
    googleTasksService.applyGoogleStatusAndDue(tarea, {
      id: 'gt-1',
      status: 'completed',
      due: '2026-05-20T00:00:00.000Z',
      completed: '2026-05-19T12:00:00.000Z',
      updated: '2026-05-19T12:00:00.000Z',
    });
    expect(tarea.completada).toBe(true);
    expect(tarea.estado).toBe('COMPLETADA');
    expect(tarea.fechaVencimiento.getDate()).toBe(20);
    expect(tarea.fechaVencimiento.getMonth()).toBe(4);
  });

  test('shouldImportFromGoogle when due or notes differ', () => {
    const googleTask = {
      due: '2026-05-20T00:00:00.000Z',
      updated: '2026-05-18T10:00:00.000Z',
      notes: '',
    };
    const tarea = {
      fechaVencimiento: new Date(2026, 4, 21, 12, 0, 0, 0),
      updatedAt: new Date('2026-05-18T14:00:00.000Z'),
      googleTasksSync: { needsSync: false, syncStatus: 'synced', updated: new Date('2026-05-18T14:00:00.000Z') },
    };
    expect(googleTasksService.shouldImportFromGoogle(tarea, googleTask)).toBe(true);
  });

  test('shouldApplyGoogleUpdate respects needsSync and timestamps', () => {
    const googleTask = { updated: '2026-05-18T12:00:00.000Z' };

    const pendingLocal = {
      updatedAt: new Date('2026-05-18T13:00:00.000Z'),
      googleTasksSync: { needsSync: true, syncStatus: 'pending' }
    };
    expect(googleTasksService.shouldApplyGoogleUpdate(pendingLocal, googleTask)).toBe(false);

    const staleLocal = {
      updatedAt: new Date('2026-05-18T10:00:00.000Z'),
      googleTasksSync: { needsSync: false, syncStatus: 'synced', updated: new Date('2026-05-18T10:00:00.000Z') }
    };
    expect(googleTasksService.shouldApplyGoogleUpdate(staleLocal, googleTask)).toBe(true);

    const freshLocal = {
      updatedAt: new Date('2026-05-18T14:00:00.000Z'),
      googleTasksSync: { needsSync: false, syncStatus: 'synced', updated: new Date('2026-05-18T14:00:00.000Z') }
    };
    expect(googleTasksService.shouldApplyGoogleUpdate(freshLocal, googleTask)).toBe(false);
  });

  test('applyGoogleStatusFromGoogle preserves needsSync when local export pending', () => {
    const tarea = new Tareas({
      titulo: 'Test',
      usuario: '507f1f77bcf86cd799439011',
      estado: 'PENDIENTE',
      completada: false,
      googleTasksSync: { enabled: true, needsSync: true, syncStatus: 'pending' },
    });
    googleTasksService.applyGoogleStatusFromGoogle(tarea, {
      id: 'gt-1',
      status: 'completed',
      completed: '2026-05-19T12:00:00.000Z',
      updated: '2026-05-19T12:00:00.000Z',
    }, { preservePendingExport: true });
    expect(tarea.completada).toBe(true);
    expect(tarea.estado).toBe('COMPLETADA');
    expect(tarea.googleTasksSync.needsSync).toBe(true);
    expect(tarea.googleTasksSync.syncStatus).toBe('pending');
  });

  test('shouldApplyGoogleDueDespitePending when Google due is newer than last sync', () => {
    const googleTask = {
      due: '2026-08-28T00:00:00.000Z',
      updated: '2026-08-28T10:00:00.000Z',
    };
    const tarea = {
      fechaVencimiento: new Date(2026, 7, 21, 12, 0, 0, 0),
      googleTasksSync: {
        needsSync: true,
        syncStatus: 'pending',
        updated: new Date('2026-08-21T08:00:00.000Z'),
      },
    };
    expect(googleTasksService.shouldApplyGoogleDueDespitePending(tarea, googleTask)).toBe(true);
  });

  test('pending local blocks content import but not status refresh', () => {
    const googleTask = {
      status: 'completed',
      due: '2026-05-20T00:00:00.000Z',
      notes: 'Cambiado en Google',
      updated: '2026-05-18T18:00:00.000Z',
    };
    const pending = {
      completada: false,
      estado: 'PENDIENTE',
      fechaVencimiento: new Date(2026, 4, 19, 12, 0, 0, 0),
      descripcion: 'Local',
      googleTasksSync: { needsSync: true, syncStatus: 'pending' },
    };
    expect(googleTasksService.hasLocalPendingGoogleSync(pending)).toBe(true);
    expect(googleTasksService.shouldRefreshGoogleStatus(pending, googleTask)).toBe(true);
    expect(googleTasksService.shouldImportContentFromGoogle(pending, googleTask)).toBe(false);
    expect(googleTasksService.shouldRefreshGoogleDueDate(pending, googleTask)).toBe(false);
    expect(googleTasksService.shouldRefreshGoogleNotes(pending, googleTask)).toBe(false);
    expect(googleTasksService.shouldImportFromGoogle(pending, googleTask)).toBe(true);
  });
});
