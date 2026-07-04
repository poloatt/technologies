import {
  resolveUndoScope,
  findLastActionIndexForScope,
  countActionsForScope,
  migrateLegacyActions,
  inferScopeFromAction,
} from '@shared/config/undoScopeConfig.js';

describe('undoScopeConfig', () => {
  test('resolveUndoScope maps foco routes', () => {
    expect(resolveUndoScope('/tareas')).toBe('tareas');
    expect(resolveUndoScope('/objetivos')).toBe('objetivos');
    expect(resolveUndoScope('/rutinas')).toBe('rutinas');
    expect(resolveUndoScope('/foco')).toBeNull();
    expect(resolveUndoScope('/archivo')).toBe('archivo');
    expect(resolveUndoScope('/unknown')).toBeNull();
  });

  test('findLastActionIndexForScope returns most recent matching scope', () => {
    const history = [
      { id: 1, scope: 'tareas', entity: 'tarea' },
      { id: 2, scope: 'rutinas', entity: 'rutina' },
      { id: 3, scope: 'tareas', entity: 'tarea' },
    ];

    expect(findLastActionIndexForScope(history, 'tareas')).toBe(0);
    expect(findLastActionIndexForScope(history, 'rutinas')).toBe(1);
    expect(findLastActionIndexForScope(history, 'objetivos')).toBe(-1);
  });

  test('countActionsForScope counts only matching scope', () => {
    const history = [
      { scope: 'tareas' },
      { scope: 'rutinas' },
      { scope: 'tareas' },
    ];

    expect(countActionsForScope(history, 'tareas')).toBe(2);
    expect(countActionsForScope(history, 'hub')).toBe(0);
  });

  test('migrateLegacyActions infers scope and normalizes entity', () => {
    const migrated = migrateLegacyActions([
      { entity: 'OBJETIVO', type: 'UPDATE' },
      { entity: 'tarea', type: 'CREATE', scope: 'hub' },
    ]);

    expect(migrated[0].entity).toBe('objetivo');
    expect(migrated[0].scope).toBe('objetivos');
    expect(migrated[1].scope).toBe('hub');
    expect(inferScopeFromAction(migrated[0])).toBe('objetivos');
  });
});
