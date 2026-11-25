import { useCallback, useEffect, useRef, useState } from 'react';
import clienteAxios from '@shared/config/axios';

/** Primera pintura corta; el resto entra al acercarse al final de la lista. */
export const TRANSACCIONES_PAGE_SIZE = 30;

function isCanceled(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
}

function pageHasMore(data) {
  if (!data) return false;
  if (typeof data.hasNextPage === 'boolean') return data.hasNextPage;
  const page = Number(data.page) || 1;
  const totalPages = Number(data.totalPages) || 1;
  return page < totalPages;
}

function listParams({ fechaInicio, fechaFin, cuentaId, page, limit, ledger, kinds, yieldSide, estado }) {
  const params = {
    page,
    limit,
    sort: '-fecha',
  };
  if (fechaInicio) params.fechaInicio = fechaInicio;
  if (fechaFin) params.fechaFin = fechaFin;
  if (cuentaId) params.cuenta = cuentaId;
  if (ledger) params.ledger = ledger;
  if (kinds) params.kinds = kinds;
  if (yieldSide) params.yieldSide = yieldSide;
  if (estado) params.estado = estado;
  return params;
}

/**
 * Listado paginado del período visible.
 * `hasAny` distingue "no hay movimientos" de "no hay en este corte"
 * con una sonda de 1 documento, solo cuando la página del período viene vacía.
 */
export function useTransaccionesList({
  fechaInicio,
  fechaFin,
  cuentaId,
  ledger,
  kinds,
  yieldSide,
  estado,
  pageSize = TRANSACCIONES_PAGE_SIZE,
} = {}) {
  const [docs, setDocs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasAny, setHasAny] = useState(null);

  const generation = useRef(0);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const abortRef = useRef(null);

  const fetchPage = useCallback((page, signal) => (
    clienteAxios.get('/api/transacciones', {
      params: listParams({
        fechaInicio,
        fechaFin,
        cuentaId,
        ledger,
        kinds,
        yieldSide,
        estado,
        page,
        limit: pageSize,
      }),
      signal,
    }).then((response) => response.data)
  ), [fechaInicio, fechaFin, cuentaId, ledger, kinds, yieldSide, estado, pageSize]);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const gen = ++generation.current;

    hasMoreRef.current = false;
    loadingRef.current = true;
    loadingMoreRef.current = false;
    pageRef.current = 0;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setHasAny(null);
    setDocs([]);
    setHasMore(false);

    try {
      const data = await fetchPage(1, controller.signal);
      if (generation.current !== gen) return;

      const nextDocs = data?.docs || [];
      pageRef.current = data?.page || 1;
      hasMoreRef.current = pageHasMore(data);
      setDocs(nextDocs);
      setHasMore(hasMoreRef.current);

      if (nextDocs.length === 0) {
        const probe = await clienteAxios.get('/api/transacciones', {
          params: listParams({ cuentaId, ledger, estado, page: 1, limit: 1 }),
          signal: controller.signal,
        });
        if (generation.current !== gen) return;
        setHasAny((probe.data?.totalDocs || 0) > 0);
      } else {
        setHasAny(true);
      }
    } catch (err) {
      if (generation.current !== gen || isCanceled(err)) return;
      setError(err);
      setDocs([]);
      hasMoreRef.current = false;
      setHasMore(false);
      setHasAny(false);
    } finally {
      if (generation.current === gen) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [fetchPage, cuentaId]);

  useEffect(() => {
    reload();
    return () => {
      generation.current += 1;
      abortRef.current?.abort();
    };
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loadingRef.current || !hasMoreRef.current) return;

    const gen = generation.current;
    const nextPage = pageRef.current + 1;
    const controller = new AbortController();
    abortRef.current = controller;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const data = await fetchPage(nextPage, controller.signal);
      if (generation.current !== gen) return;
      pageRef.current = data?.page || nextPage;
      hasMoreRef.current = pageHasMore(data);
      setDocs((prev) => {
        // Evita filas repetidas si una página trae documentos que ya están en la lista.
        const seen = new Set(prev.map((doc) => String(doc.id || doc._id)));
        const fresh = (data?.docs || []).filter((doc) => !seen.has(String(doc.id || doc._id)));
        return [...prev, ...fresh];
      });
      setHasMore(hasMoreRef.current);
    } catch (err) {
      if (generation.current !== gen || isCanceled(err)) return;
      setError(err);
    } finally {
      loadingMoreRef.current = false;
      if (generation.current === gen) setLoadingMore(false);
    }
  }, [fetchPage]);

  return {
    transacciones: docs,
    loading,
    loadingMore,
    error,
    hasMore,
    hasAny,
    loadMore,
    refetch: reload,
  };
}
