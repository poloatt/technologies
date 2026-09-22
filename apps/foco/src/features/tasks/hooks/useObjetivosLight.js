import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { fetchObjetivosLight } from '../api/tasksApi';

const OBJETIVOS_TTL_MS = 30000;
let objetivosCache = null; // { docs, timestamp }
let objetivosInFlight = null;

function peekObjetivosCache() {
  if (!objetivosCache) return null;
  return {
    ...objetivosCache,
    stale: Date.now() - objetivosCache.timestamp >= OBJETIVOS_TTL_MS,
  };
}

function loadObjetivosLight({ force = false } = {}) {
  if (!force && objetivosInFlight) return objetivosInFlight;
  const promise = fetchObjetivosLight()
    .then((docs) => {
      objetivosCache = { docs, timestamp: Date.now() };
      return docs;
    })
    .finally(() => {
      objetivosInFlight = null;
    });
  objetivosInFlight = promise;
  return promise;
}

function withTareas(docs = []) {
  return docs.map((o) => ({ ...o, tareas: o.tareas || [] }));
}

/** Prefetch para abrir /objetivos (y formularios) en caliente. */
export function prefetchObjetivosLight() {
  const cached = peekObjetivosCache();
  if (cached && !cached.stale) return;
  if (objetivosInFlight) return;
  loadObjetivosLight().catch(() => {});
}

export function invalidateObjetivosLightCache() {
  objetivosCache = null;
}

/**
 * Objetivos light con caché de módulo + SWR.
 * No bloquea la UI: shell inmediato; datos desde caché o fetch en background.
 */
export function useObjetivosLight({ autoFetch = true } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const initialCache = peekObjetivosCache();
  const [objetivos, setObjetivos] = useState(() => (
    initialCache ? withTareas(initialCache.docs) : []
  ));
  const [isFetching, setIsFetching] = useState(
    autoFetch && (!initialCache || Boolean(initialCache?.stale)),
  );

  const refetch = useCallback(async ({ force = true } = {}) => {
    setIsFetching(true);
    try {
      const docs = await loadObjetivosLight({ force });
      const next = withTareas(docs);
      setObjetivos(next);
      return docs;
    } catch (error) {
      console.error('Error al cargar objetivos:', error);
      enqueueSnackbar('Error al cargar Objetivos', { variant: 'error' });
      return null;
    } finally {
      setIsFetching(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (!autoFetch) return undefined;

    let cancelled = false;
    const cached = peekObjetivosCache();

    if (cached) {
      setObjetivos(withTareas(cached.docs));
      if (!cached.stale) {
        setIsFetching(false);
        loadObjetivosLight({ force: true })
          .then((docs) => {
            if (!cancelled) setObjetivos(withTareas(docs));
          })
          .catch(() => {});
        return () => { cancelled = true; };
      }
    }

    setIsFetching(true);
    loadObjetivosLight()
      .then((docs) => {
        if (!cancelled) setObjetivos(withTareas(docs));
      })
      .catch((error) => {
        console.error('Error al cargar objetivos:', error);
        if (!cancelled && !cached) {
          enqueueSnackbar('Error al cargar Objetivos', { variant: 'error' });
          setObjetivos([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, [autoFetch, enqueueSnackbar]);

  return {
    objetivos,
    setObjetivos,
    /** Compat: páginas no deben bloquearse por este flag. */
    loading: false,
    isFetching,
    refetch,
  };
}
