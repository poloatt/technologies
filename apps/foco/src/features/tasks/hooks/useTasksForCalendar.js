import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addWeeks, endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { CADENCIA_WEEK_STARTS_ON } from '@shared/habits';
import { useSnackbar } from 'notistack';
import { normalizeTaskList } from '@shared/utils/taskListUtils';
import { fetchTasksForAgendaRange } from '../api/tasksApi';

// Caché por rango + dedup de requests en vuelo, compartida entre montajes.
// Permite alternar día/semana (o volver a un rango ya visto) sin spinner ni
// refetch bloqueante: se sirve la caché al instante y se revalida en background.
const AGENDA_TTL_MS = 30000;
const agendaCache = new Map(); // rangeKey -> { docs, timestamp }
const agendaInFlight = new Map(); // rangeKey -> Promise<docs>

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

// Prefetch en background: calienta la caché sin tocar loading/tasks del rango actual.
function prefetchAgendaRange(range, includeCompleted) {
  const key = rangeKeyOf(range, includeCompleted);
  const cached = agendaCache.get(key);
  if (cached && Date.now() - cached.timestamp < AGENDA_TTL_MS) return;
  if (agendaInFlight.has(key)) return;
  loadAgendaRange(key, {
    from: range.start,
    to: range.end,
    includeCompleted,
  }).catch(() => {});
}

export function useTasksForCalendar(selectedDate, viewMode = 'week') {
  const { enqueueSnackbar } = useSnackbar();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  useEffect(() => {
    const handleSetShowCompleted = (event) => {
      const { value } = event.detail || {};
      if (typeof value === 'boolean') setIncludeCompleted(value);
    };
    window.addEventListener('setShowCompleted', handleSetShowCompleted);
    return () => window.removeEventListener('setShowCompleted', handleSetShowCompleted);
  }, []);

  const range = useMemo(
    () => computeRange(selectedDate || new Date(), viewMode),
    [selectedDate, viewMode],
  );

  const rangeKey = useMemo(
    () => `${range.start.getTime()}|${range.end.getTime()}|${includeCompleted}`,
    [range.start, range.end, includeCompleted],
  );

  // Mantener el rango actual accesible para refetch sin recrear el callback
  const rangeRef = useRef({ rangeKey, range, includeCompleted });
  rangeRef.current = { rangeKey, range, includeCompleted };

  const refetch = useCallback(async () => {
    const { rangeKey: key, range: r, includeCompleted: inc } = rangeRef.current;
    try {
      setLoading(true);
      // Refresco explícito (normalmente tras una mutación): invalidar todos los
      // rangos para que al alternar día/semana se revaliden y no queden viejos.
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
      setTasks([]);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    let cancelled = false;

    const cached = agendaCache.get(rangeKey);
    const isFresh = cached && Date.now() - cached.timestamp < AGENDA_TTL_MS;

    // Stale-while-revalidate: si hay caché, mostrarla ya y revalidar sin spinner
    if (cached) {
      setTasks(normalizeTaskList(cached.docs));
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (isFresh) {
      return () => { cancelled = true; };
    }

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
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [rangeKey, enqueueSnackbar, range.start, range.end, includeCompleted]);

  // Prefetch en background (en idle) del rango adyacente y del "otro modo de vista"
  // para que avanzar semana/día o alternar día/semana sea instantáneo la primera vez.
  useEffect(() => {
    const base = selectedDate || new Date();
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

  return { tasks, setTasks, loading, range, refetch, includeCompleted };
}
