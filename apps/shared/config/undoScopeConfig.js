import { matchTiempoSection } from '../navigation/tiempoToolbarPaths';

/**
 * Scopes de deshacer por página de Foco.
 * Cada acción registrada debe incluir `scope` para que el undo sea contextual.
 */
export const UNDO_SCOPES = {
  objetivos: {
    entities: ['objetivo', 'tarea'],
    paths: ['/objetivos'],
  },
  tareas: {
    entities: ['tarea', 'rutina_section'],
    paths: ['/tareas'],
  },
  rutinas: {
    entities: ['rutina', 'rutina_section', 'rutina_config', 'habit'],
    paths: ['/rutinas'],
  },
  archivo: {
    entities: ['tarea'],
    paths: ['/archivo'],
  },
};

/** Mapa entity → scope por defecto para acciones legacy sin scope. */
export const LEGACY_ENTITY_SCOPE_MAP = {
  objetivo: 'objetivos',
  OBJETIVO: 'objetivos',
  tarea: 'tareas',
  rutina: 'rutinas',
  rutina_section: 'rutinas',
  rutina_config: 'rutinas',
  habit: 'rutinas',
};

/**
 * Resuelve el scope de undo para una ruta.
 * @param {string} path
 * @returns {string|null}
 */
export function resolveUndoScope(path = '') {
  if (path === '/archivo' || path.startsWith('/archivo/')) {
    return 'archivo';
  }

  const section = matchTiempoSection(path);
  if (section) return section;

  return null;
}

/**
 * Infiere scope para acciones legacy sin campo scope.
 * @param {object} action
 * @returns {string|null}
 */
export function inferScopeFromAction(action) {
  if (action?.scope) return action.scope;
  if (!action?.entity) return null;
  return LEGACY_ENTITY_SCOPE_MAP[action.entity] || null;
}

/**
 * Normaliza entidades legacy a minúsculas canónicas.
 * @param {string} entity
 * @returns {string}
 */
export function normalizeUndoEntity(entity) {
  if (!entity) return entity;
  if (entity === 'OBJETIVO') return 'objetivo';
  return entity;
}

/**
 * Índice de la acción más reciente para un scope (stack global, LIFO por scope).
 */
export function findLastActionIndexForScope(actionHistory, scope) {
  if (!scope || !Array.isArray(actionHistory)) return -1;
  return actionHistory.findIndex((action) => action.scope === scope);
}

/**
 * Cuenta acciones por scope.
 */
export function countActionsForScope(actionHistory, scope) {
  if (!scope || !Array.isArray(actionHistory)) return 0;
  return actionHistory.filter((action) => action.scope === scope).length;
}

/**
 * Migra acciones legacy sin scope.
 */
export function migrateLegacyActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => normalizeStoredAction(action));
}

function normalizeStoredAction(action) {
  if (!action || typeof action !== 'object') return action;
  return {
    ...action,
    entity: normalizeUndoEntity(action.entity),
    scope: action.scope || inferScopeFromAction(action),
  };
}

/**
 * Obtiene las entidades permitidas para un scope.
 */
export function getEntitiesForScope(scope) {
  return UNDO_SCOPES[scope]?.entities || [];
}
