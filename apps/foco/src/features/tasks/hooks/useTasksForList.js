import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { normalizeTaskList } from '@shared/utils/taskListUtils';
import { getDefaultListRangeDates } from '../../../domain/agendaHorizons';
import { fetchTasksForList } from '../api/tasksApi';

/** TTL alineado con agenda: volver a /tareas no re-bloquea con spinner. */
const LIST_TTL_MS = 30000;
const TASKS_LIST_STORAGE_KEY = 'attadia_tasks_list_v1';
const listCache = new Map();
const listInFlight = new Map();

function getCurrentCachedUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('cachedUser');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id || parsed?._id || null;
  } catch {
    return null;
  }
}

function listCacheKey(includeCompleted) {
  const { from, to } = getDefaultListRangeDates();
  return `${from.toISOString().slice(0, 10)}|${to.toISOString().slice(0, 10)}|${includeCompleted}`;
}

function readListStorageCache(key) {
  if (typeof window === 'undefined') return null;
  const userId = getCurrentCachedUserId();
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(TASKS_LIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId || parsed.key !== key || !Array.isArray(parsed.docs)) {
      return null;
    }
    return {
      docs: parsed.docs,
      timestamp: parsed.ts || 0,
      source: 'storage',
    };
  } catch {
    return null;
  }
}

function writeListStorageCache(key, docs) {
  if (typeof window === 'undefined' || !Array.isArray(docs)) return;
  const userId = getCurrentCachedUserId();
  if (!userId) return;
  try {
    localStorage.setItem(TASKS_LIST_STORAGE_KEY, JSON.stringify({
      userId,
      key,
      docs,
      ts: Date.now(),
    }));
  } catch {
    // Silenciar errores de cuota/serialización
  }
}

function peekListCache(includeCompleted) {
  const key = listCacheKey(includeCompleted);
  let cached = listCache.get(key);
  if (!cached) {
    const stored = readListStorageCache(key);
    if (stored) {
      cached = stored;
      listCache.set(key, stored);
    }
  }
  if (!cached) return null;
  return {
    ...cached,
    key,
    stale: Date.now() - cached.timestamp >= LIST_TTL_MS,
  };
}

function loadTasksList(includeCompleted, { force = false } = {}) {
  const key = listCacheKey(includeCompleted);
  if (!force && listInFlight.has(key)) {
    return listInFlight.get(key);
  }
  const promise = fetchTasksForList({ includeCompleted })
    .then((docs) => {
      listCache.set(key, { docs, timestamp: Date.now(), source: 'network' });
      writeListStorageCache(key, docs);
      return docs;
    })
    .finally(() => {
      listInFlight.delete(key);
    });
  listInFlight.set(key, promise);
  return promise;
}

/** Prefetch para abrir /tareas en caliente desde otras rutas. */
export function prefetchTasksForList(includeCompleted = false) {
  const cached = peekListCache(includeCompleted);
  if (cached && !cached.stale && cached.source === 'network') return;
  if (listInFlight.has(listCacheKey(includeCompleted))) return;
  loadTasksList(includeCompleted).catch(() => {});
}

export function invalidateTasksForListCache() {
  listCache.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(TASKS_LIST_STORAGE_KEY);
    } catch {
      // noop
    }
  }
}

/**
 * Lista /tareas con caché de módulo + localStorage (SWR, paridad con useTasksForCalendar).
 * No bloquea la página: shell inmediato; datos desde caché o fetch en background.
 */
export function useTasksForList({ includeCompleted: includeCompletedInitial = false } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const initialCache = peekListCache(includeCompletedInitial);
  const [tasks, setTasksState] = useState(() => (
    initialCache ? normalizeTaskList(initialCache.docs) : []
  ));
  const [includeCompleted, setIncludeCompleted] = useState(includeCompletedInitial);
  const [isFetching, setIsFetching] = useState(
    !initialCache || initialCache.source !== 'network' || Boolean(initialCache?.stale),
  );

  const setTasks = useCallback((updater) => {
    setTasksState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Array.isArray(next)) {
        const key = listCacheKey(includeCompleted);
        listCache.set(key, { docs: next, timestamp: Date.now(), source: 'network' });
        writeListStorageCache(key, next);
      }
      return next;
    });
  }, [includeCompleted]);

  useEffect(() => {
    const handleSetShowCompleted = (event) => {
      const { value } = event.detail || {};
      if (typeof value === 'boolean') setIncludeCompleted(value);
    };
    window.addEventListener('setShowCompleted', handleSetShowCompleted);
    return () => window.removeEventListener('setShowCompleted', handleSetShowCompleted);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = peekListCache(includeCompleted);

    if (cached) {
      setTasksState(normalizeTaskList(cached.docs));
      // Si ya llegó de red dentro del TTL (ej. prefetch de App.jsx), no disparar un segundo request inmediato.
      if (!cached.stale && cached.source === 'network') {
        setIsFetching(false);
        return () => { cancelled = true; };
      }
      // Caché hidratada desde localStorage o vencida: revalidar en background sin bloquear ni mostrar skeleton.
      setIsFetching(false);
      loadTasksList(includeCompleted)
        .then((docs) => {
          if (!cancelled) setTasksState(normalizeTaskList(docs));
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }

    setIsFetching(true);
    loadTasksList(includeCompleted)
      .then((docs) => {
        if (!cancelled) setTasksState(normalizeTaskList(docs));
      })
      .catch((error) => {
        console.error('Error al cargar tareas:', error);
        if (!cancelled && !cached) {
          enqueueSnackbar('Error al cargar tareas', { variant: 'error' });
          setTasksState([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, [includeCompleted, enqueueSnackbar]);

  const refetch = useCallback(async () => {
    setIsFetching(true);
    try {
      const docs = await loadTasksList(includeCompleted, { force: true });
      setTasksState(normalizeTaskList(docs));
      return docs;
    } catch (error) {
      console.error('Error al cargar tareas:', error);
      enqueueSnackbar('Error al cargar tareas', { variant: 'error' });
      return null;
    } finally {
      setIsFetching(false);
    }
  }, [enqueueSnackbar, includeCompleted]);

  return {
    tasks,
    setTasks,
    /** Compat: la página nunca se bloquea por este flag. */
    loading: false,
    isFetching,
    refetch,
    includeCompleted,
  };
}
