import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { fetchObjetivosLight } from '../api/tasksApi';

const OBJETIVOS_TTL_MS = 30000;
const OBJETIVOS_STORAGE_KEY = 'attadia_objetivos_light_v1';
let objetivosCache = null; // { docs, timestamp, source }
let objetivosInFlight = null;

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

function readObjetivosStorageCache() {
  if (typeof window === 'undefined') return null;
  const userId = getCurrentCachedUserId();
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(OBJETIVOS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.docs)) return null;
    return { docs: parsed.docs, timestamp: parsed.ts || 0, source: 'storage' };
  } catch {
    return null;
  }
}

function writeObjetivosStorageCache(docs) {
  if (typeof window === 'undefined' || !Array.isArray(docs)) return;
  const userId = getCurrentCachedUserId();
  if (!userId) return;
  try {
    localStorage.setItem(OBJETIVOS_STORAGE_KEY, JSON.stringify({
      userId,
      docs,
      ts: Date.now(),
    }));
  } catch {
    // Silenciar errores de cuota/serialización
  }
}

function peekObjetivosCache() {
  if (!objetivosCache) {
    const stored = readObjetivosStorageCache();
    if (stored) objetivosCache = stored;
  }
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
      objetivosCache = { docs, timestamp: Date.now(), source: 'network' };
      writeObjetivosStorageCache(docs);
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
  if (cached && !cached.stale && cached.source === 'network') return;
  if (objetivosInFlight) return;
  loadObjetivosLight().catch(() => {});
}

export function invalidateObjetivosLightCache() {
  objetivosCache = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(OBJETIVOS_STORAGE_KEY);
    } catch {
      // noop
    }
  }
}

/**
 * Objetivos light con caché de módulo + localStorage (SWR).
 * No bloquea la UI: shell inmediato; datos desde caché o fetch en background.
 */
export function useObjetivosLight({ autoFetch = true } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const initialCache = peekObjetivosCache();
  const [objetivos, setObjetivos] = useState(() => (
    initialCache ? withTareas(initialCache.docs) : []
  ));
  const [isFetching, setIsFetching] = useState(
    autoFetch && (!initialCache || initialCache.source !== 'network' || Boolean(initialCache?.stale)),
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
      if (!cached.stale && cached.source === 'network') {
        setIsFetching(false);
        return () => { cancelled = true; };
      }
      setIsFetching(false);
      loadObjetivosLight()
        .then((docs) => {
          if (!cancelled) setObjetivos(withTareas(docs));
        })
        .catch(() => {});
      return () => { cancelled = true; };
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
