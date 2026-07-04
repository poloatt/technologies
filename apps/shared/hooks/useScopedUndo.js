import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActionHistory, ACTION_TYPES } from '../context/ActionHistoryContext';
import { useActionHistoryRoutes } from '../context/ActionHistoryRoutesContext.jsx';
import { resolveUndoScope, getEntitiesForScope, UNDO_SCOPES } from '../config/undoScopeConfig';
import { revertAction } from '../undo/undoRevertHandlers';

/**
 * Devuelve el scope de undo para la ruta actual.
 */
export function useUndoScope(forcedPath) {
  const location = useLocation();
  const path = forcedPath || location.pathname;

  return useMemo(() => resolveUndoScope(path), [path]);
}

/**
 * Wrappers add*Action que inyectan scope automáticamente.
 */
export function useScopedActionHistory(scope) {
  const { addAction } = useActionHistory();
  const isActive = Boolean(scope && UNDO_SCOPES[scope]);

  const addCreateAction = useCallback((data, description, entity) => {
    if (!isActive) return null;
    return addAction({
      type: ACTION_TYPES.CREATE,
      entity,
      scope,
      data,
      description: description || `Crear ${entity}`,
      originalData: null,
      entityId: data._id || data.id,
    });
  }, [addAction, scope, isActive]);

  const addUpdateAction = useCallback((newData, originalData, description, entity) => {
    if (!isActive) return null;
    return addAction({
      type: ACTION_TYPES.UPDATE,
      entity,
      scope,
      data: newData,
      originalData,
      description: description || `Actualizar ${entity}`,
      entityId: newData._id || newData.id || originalData?._id || originalData?.id,
    });
  }, [addAction, scope, isActive]);

  const addDeleteAction = useCallback((deletedData, description, entity) => {
    if (!isActive) return null;
    return addAction({
      type: ACTION_TYPES.DELETE,
      entity,
      scope,
      data: null,
      originalData: deletedData,
      description: description || `Eliminar ${entity}`,
      entityId: deletedData._id || deletedData.id,
    });
  }, [addAction, scope, isActive]);

  const addScopedAction = useCallback((action) => {
    if (!isActive) return null;
    return addAction({ ...action, scope: action.scope || scope });
  }, [addAction, scope, isActive]);

  return useMemo(() => ({
    addCreateAction,
    addUpdateAction,
    addDeleteAction,
    addScopedAction,
    scope,
    isActive,
  }), [addCreateAction, addUpdateAction, addDeleteAction, addScopedAction, scope, isActive]);
}

/**
 * CRUD con historial scoped.
 */
export function useScopedCRUD(scope, entityType, apiService) {
  const {
    addCreateAction,
    addUpdateAction,
    addDeleteAction,
  } = useScopedActionHistory(scope);

  const createWithHistory = useCallback(async (data) => {
    const result = await apiService.create(data);
    addCreateAction(result, `Crear ${entityType} "${result.nombre || result.titulo || result._id}"`, entityType);
    return result;
  }, [apiService, addCreateAction, entityType]);

  const updateWithHistory = useCallback(async (id, updates, originalData) => {
    const result = await apiService.update(id, updates);

    let cleanOriginalData = originalData;
    if (entityType === 'tarea' && originalData) {
      cleanOriginalData = { ...originalData, subtareas: originalData.subtareas || [] };
    }

    addUpdateAction(
      result,
      cleanOriginalData,
      `Actualizar ${entityType} "${result.nombre || result.titulo || result._id}"`,
      entityType,
    );
    return result;
  }, [apiService, addUpdateAction, entityType]);

  const deleteWithHistory = useCallback(async (id) => {
    let originalData;
    try {
      originalData = await apiService.getById(id);
    } catch (getError) {
      if (getError.response?.status === 404) {
        return { success: true, message: 'Ya eliminada' };
      }
      throw getError;
    }

    const result = await apiService.delete(id);
    addDeleteAction(originalData, `Eliminar ${entityType} "${originalData.nombre || originalData.titulo || originalData._id}"`, entityType);
    return result;
  }, [apiService, addDeleteAction, entityType]);

  return useMemo(() => ({
    createWithHistory,
    updateWithHistory,
    deleteWithHistory,
  }), [createWithHistory, updateWithHistory, deleteWithHistory]);
}

/**
 * Resuelve apiServices del routesMap para las entidades del scope.
 */
function buildApiServicesForScope(scope, routesMap, currentPath) {
  if (!routesMap || !scope) return {};

  const entities = getEntitiesForScope(scope);
  const apiServices = {};

  for (const entity of entities) {
    const match = Object.entries(routesMap)
      .filter(([, config]) => config.entity === entity)
      .sort(([a], [b]) => b.length - a.length)[0];
    if (match) {
      apiServices[entity] = match[1].apiService;
    }
  }

  if (!apiServices.tarea && entities.includes('tarea')) {
    const tareaRoute = routesMap['/tareas'] || routesMap['/archivo'];
    if (tareaRoute?.apiService) {
      apiServices.tarea = tareaRoute.apiService;
    }
  }

  if (!apiServices.objetivo && entities.includes('objetivo') && routesMap['/objetivos']) {
    apiServices.objetivo = routesMap['/objetivos'].apiService;
  }

  if (!apiServices.rutina && entities.includes('rutina') && routesMap['/rutinas']) {
    apiServices.rutina = routesMap['/rutinas'].apiService;
  }

  if (Object.keys(apiServices).length === 0) {
    const candidates = Object.keys(routesMap)
      .filter((base) => currentPath.startsWith(base))
      .sort((a, b) => b.length - a.length);
    if (candidates.length > 0) {
      const config = routesMap[candidates[0]];
      apiServices[config.entity] = config.apiService;
    }
  }

  return apiServices;
}

/**
 * Handler de undo scoped: solo procesa acciones del scope montado.
 */
export function useScopedUndoHandler(scope, fetchData, onError = console.error, deps = {}) {
  const location = useLocation();
  const { routesMap } = useActionHistoryRoutes();
  const listenerRef = useRef(null);
  const processedActionsRef = useRef(new Set());
  const depsRef = useRef(deps);

  useEffect(() => {
    depsRef.current = deps;
  }, [deps]);

  const apiServices = useMemo(
    () => buildApiServicesForScope(scope, routesMap, location.pathname),
    [scope, routesMap, location.pathname],
  );

  useEffect(() => {
    if (!scope) return;

    if (listenerRef.current) {
      window.removeEventListener('undoAction', listenerRef.current);
    }

    const handleUndoAction = async (event) => {
      const action = event.detail;
      if (!action || action.scope !== scope) return;

      if (processedActionsRef.current.has(action.id)) return;
      processedActionsRef.current.add(action.id);

      try {
        await revertAction(action, {
          apiServices,
          deps: depsRef.current,
        });

        if (fetchData) {
          await fetchData();
        }
      } catch (error) {
        console.error('useScopedUndoHandler - Error reverting action:', error);
        onError(error);
      }
    };

    listenerRef.current = handleUndoAction;
    window.addEventListener('undoAction', handleUndoAction);

    return () => {
      if (listenerRef.current) {
        window.removeEventListener('undoAction', listenerRef.current);
        listenerRef.current = null;
      }
      processedActionsRef.current.clear();
    };
  }, [scope, fetchData, onError, apiServices]);
}

/**
 * Hook global scoped: detecta entidad principal de la ruta + CRUD con historial.
 */
export function useScopedGlobalActionHistory(scope, fetchData, onError, forcedPath) {
  const location = useLocation();
  const currentPath = forcedPath || location.pathname;
  const { routesMap } = useActionHistoryRoutes();

  const entityConfig = useMemo(() => {
    if (!routesMap) return undefined;
    const candidates = Object.keys(routesMap)
      .filter(base => currentPath.startsWith(base))
      .sort((a, b) => b.length - a.length);
    if (candidates.length > 0) return routesMap[candidates[0]];
    return undefined;
  }, [currentPath, routesMap]);

  const effectiveScope = scope || resolveUndoScope(currentPath);

  if (!entityConfig || !effectiveScope) {
    return useMemo(() => ({
      isSupported: false,
      scope: effectiveScope,
      entity: null,
      createWithHistory: null,
      updateWithHistory: null,
      deleteWithHistory: null,
      addCreateAction: null,
      addUpdateAction: null,
      addDeleteAction: null,
      addScopedAction: null,
    }), [effectiveScope]);
  }

  const { entity, apiService } = entityConfig;
  const scopedHistory = useScopedActionHistory(effectiveScope);
  const crud = useScopedCRUD(effectiveScope, entity, apiService);

  return useMemo(() => ({
    isSupported: true,
    scope: effectiveScope,
    entity,
    ...crud,
    ...scopedHistory,
  }), [effectiveScope, entity, crud, scopedHistory]);
}

/**
 * Combo para páginas: scope + CRUD + handler de undo.
 */
export function useScopedPageHistory(fetchData, onError, options = {}) {
  const { forcedPath, scope: forcedScope, deps } = options;
  const scope = forcedScope || useUndoScope(forcedPath);
  const historyUtils = useScopedGlobalActionHistory(scope, fetchData, onError, forcedPath);
  useScopedUndoHandler(scope, fetchData, onError, deps);

  return useMemo(() => historyUtils, [historyUtils]);
}

// Retrocompatibilidad: usePageWithHistory delega al scoped
export function usePageWithHistory(fetchData, onError) {
  return useScopedPageHistory(fetchData, onError);
}

// Retrocompatibilidad parcial
export function useGlobalActionHistory(fetchData, onError, forcedPath) {
  return useScopedGlobalActionHistory(null, fetchData, onError, forcedPath);
}

export function useAutoUndoHandler(fetchData, onError = console.error) {
  const scope = useUndoScope();
  useScopedUndoHandler(scope, fetchData, onError);
}
