import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addWeeks, endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { CADENCIA_WEEK_STARTS_ON } from '@shared/habits';
import { useSnackbar } from 'notistack';
import { normalizeTaskList } from '@shared/utils/taskListUtils';
import { getNormalizedToday } from '@shared/utils/dateUtils';
import { fetchTasksForAgendaRange } from '../api/tasksApi';

const AGENDA_TTL_MS = 30000;
const agendaCache = new Map();
const agendaInFlight = new Map();

function loadAgendaRange(rangeKey, { from, to, includeCompleted, force = false }) {
  if (!force && agendaInFlight.has(rangeKey)) {
    return agendaInFlight.get(rangeKey);
  }
  const promise = fetchTasksForAgendaRange({ from, to, includeCompleted })
    .then((docs) => {
      agendaCache.set(rangeKey, { docs, timestamp: Date.now() });
      return docs;
    })
    .finally(() => {
      agendaInFlight.delete(rangeKey);
    });
  agendaInFlight.set(rangeKey, promise);
  return promise;
}

function computeRange(base, viewMode) {
  if (viewMode === 'week') {
    const start = startOfWeek(base, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
    const end = endOfWeek(base, { weekStartsOn: CADENCIA_WEEK_STARTS_ON, locale: es });
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  return { start: startOfDay(base), end: endOfDay(base) };
}

function rangeKeyOf(range, includeCompleted) {
  return `${range.start.getTime()}|${range.end.getTime()}|${includeCompleted}`;
}

function peekAgendaCache(rangeKey) {
  const cached = agendaCache.get(rangeKey);
  if (!cached) return null;
  return {
    ...cached,
    stale: Date.now() - cached.timestamp >= AGENDA_TTL_MS,
  };
}

function prefetchAgendaRange(range, includeCompleted) {
  const key = rangeKeyOf(range, includeCompleted);
  const cached = peekAgendaCache(key);
  if (cached && !cached.stale) return;
  if (agendaInFlight.has(key)) return;
  loadAgendaRange(key, {
    from: range.start,
    to: range.end,
    includeCompleted,
  }).catch(() => {});
}

/** Prefetch del rango visible (hoy / semana) para abrir Agenda sin spinner. */
export function prefetchTasksForCalendar(selectedDate = null, viewMode = 'week', includeCompleted = true) {
  const range = computeRange(selectedDate || getNormalizedToday(), viewMode);
  prefetchAgendaRange(range, includeCompleted);
}

/**
 * Calendario /tareas: caché por rango + SWR.
 * Sync hydrate al montar; la UI no se bloquea con spinner a pantalla completa.
 */
export function useTasksForCalendar(selectedDate, viewMode = 'week') {
  const { enqueueSnackbar } = useSnackbar();
  // La vista agenda siempre trae completadas del rango visible.
  const includeCompleted = true;

  const range = useMemo(
    () => computeRange(selectedDate || getNormalizedToday(), viewMode),
    [selectedDate, viewMode],
  );

  const rangeKey = useMemo(
    () => rangeKeyOf(range, includeCompleted),
    [range, includeCompleted],
  );

  const initialCache = peekAgendaCache(rangeKey);
  const [tasks, setTasks] = useState(() => (
    initialCache ? normalizeTaskList(initialCache.docs) : []
  ));
  const [isFetching, setIsFetching] = useState(!initialCache || Boolean(initialCache?.stale));

  const rangeRef = useRef({ rangeKey, range, includeCompleted });
  rangeRef.current = { rangeKey, range, includeCompleted };

  const refetch = useCallback(async () => {
    const { rangeKey: key, range: r, includeCompleted: inc } = rangeRef.current;
    setIsFetching(true);
    try {
      agendaCache.clear();
      const docs = await loadAgendaRange(key, {
        from: r.start,
        to: r.end,
        includeCompleted: inc,
        force: true,
      });
      setTasks(normalizeTaskList(docs));
      return docs;
    } catch (error) {
      console.error('Error al cargar agenda:', error);
      enqueueSnackbar('Error al cargar tareas del calendario', { variant: 'error' });
      throw error;
    } finally {
      setIsFetching(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    let cancelled = false;
    const cached = peekAgendaCache(rangeKey);

    if (cached) {
      setTasks(normalizeTaskList(cached.docs));
      if (!cached.stale) {
        setIsFetching(false);
        loadAgendaRange(rangeKey, {
          from: range.start,
          to: range.end,
          includeCompleted,
          force: true,
        })
          .then((docs) => {
            if (!cancelled) setTasks(normalizeTaskList(docs));
          })
          .catch(() => {});
        return () => { cancelled = true; };
      }
    }

    setIsFetching(true);
    loadAgendaRange(rangeKey, {
      from: range.start,
      to: range.end,
      includeCompleted,
    })
      .then((docs) => {
        if (!cancelled) setTasks(normalizeTaskList(docs));
      })
      .catch(() => {
        if (!cancelled && !cached) {
          enqueueSnackbar('Error al cargar tareas del calendario', { variant: 'error' });
          setTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, [rangeKey, enqueueSnackbar, range.start, range.end, includeCompleted]);

  useEffect(() => {
    const base = selectedDate || getNormalizedToday();
    const runPrefetch = () => {
      const step = viewMode === 'week' ? addWeeks : addDays;
      prefetchAgendaRange(computeRange(step(base, 1), viewMode), includeCompleted);
      prefetchAgendaRange(computeRange(step(base, -1), viewMode), includeCompleted);
      const otherMode = viewMode === 'week' ? 'day' : 'week';
      prefetchAgendaRange(computeRange(base, otherMode), includeCompleted);
    };

    const ric = typeof window !== 'undefined' && window.requestIdleCallback;
    const id = ric
      ? window.requestIdleCallback(runPrefetch, { timeout: 1500 })
      : setTimeout(runPrefetch, 400);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [selectedDate, viewMode, includeCompleted]);

  return {
    tasks,
    setTasks,
    /** Compat: la vista Agenda no debe bloquearse. */
    loading: false,
    isFetching,
    range,
    refetch,
    includeCompleted,
  };
}
