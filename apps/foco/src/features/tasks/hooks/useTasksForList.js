import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { normalizeTaskList } from '@shared/utils/taskListUtils';
import { getDefaultListRangeDates } from '../../../domain/agendaHorizons';
import { fetchTasksForList } from '../api/tasksApi';

/** TTL alineado con agenda: volver a /tareas no re-bloquea con spinner. */
const LIST_TTL_MS = 30000;
const listCache = new Map();
const listInFlight = new Map();

function listCacheKey(includeCompleted) {
  const { from, to } = getDefaultListRangeDates();
  return `${from.toISOString().slice(0, 10)}|${to.toISOString().slice(0, 10)}|${includeCompleted}`;
}

function peekListCache(includeCompleted) {
  const key = listCacheKey(includeCompleted);
  const cached = listCache.get(key);
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
      listCache.set(key, { docs, timestamp: Date.now() });
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
  if (cached && !cached.stale) return;
  if (listInFlight.has(listCacheKey(includeCompleted))) return;
  loadTasksList(includeCompleted).catch(() => {});
}

export function invalidateTasksForListCache() {
  listCache.clear();
}

/**
 * Lista /tareas con caché de módulo + SWR (paridad con useTasksForCalendar).
 * No bloquea la página: shell inmediato; datos desde caché o fetch en background.
 */
export function useTasksForList({ includeCompleted: includeCompletedInitial = false } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const initialCache = peekListCache(includeCompletedInitial);
  const [tasks, setTasks] = useState(() => (
    initialCache ? normalizeTaskList(initialCache.docs) : []
  ));
  const [includeCompleted, setIncludeCompleted] = useState(includeCompletedInitial);
  const [isFetching, setIsFetching] = useState(!initialCache || Boolean(initialCache?.stale));

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
      setTasks(normalizeTaskList(cached.docs));
      if (!cached.stale) {
        setIsFetching(false);
        loadTasksList(includeCompleted, { force: true })
          .then((docs) => {
            if (!cancelled) setTasks(normalizeTaskList(docs));
          })
          .catch(() => {});
        return () => { cancelled = true; };
      }
    }

    setIsFetching(true);
    loadTasksList(includeCompleted)
      .then((docs) => {
        if (!cancelled) setTasks(normalizeTaskList(docs));
      })
      .catch((error) => {
        console.error('Error al cargar tareas:', error);
        if (!cancelled && !cached) {
          enqueueSnackbar('Error al cargar tareas', { variant: 'error' });
          setTasks([]);
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
      setTasks(normalizeTaskList(docs));
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
