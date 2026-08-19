import { useEffect, useState } from 'react';
import clienteAxios, { isAxiosCanceled } from '@shared/config/axios';

export function extractSectionTotal(data) {
  if (data == null) return null;
  if (typeof data.totalDocs === 'number') return data.totalDocs;
  if (Array.isArray(data.docs)) return data.totalDocs ?? data.docs.length;
  if (Array.isArray(data)) return data.length;
  return null;
}

/** Totales por id de sección. Una sola request batch a /api/stats/counts. */
export function useCajaSectionStats(endpoints = {}) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(endpoints);

    if (keys.length === 0) {
      setCounts({});
      setLoading(false);
      return undefined;
    }

    // Fallback: pedir cada endpoint por separado (modo previo) si el batch falla.
    const loadPerEndpoint = async () => {
      const entries = await Promise.all(
        keys.map(async (id) => {
          const endpoint = endpoints[id];
          if (!endpoint) return [id, null];
          try {
            const { data } = await clienteAxios.get(endpoint, {
              params: { limit: 1, page: 1 },
            });
            return [id, extractSectionTotal(data)];
          } catch (err) {
            return [id, null];
          }
        }),
      );
      if (!cancelled) {
        setCounts(Object.fromEntries(entries));
        setLoading(false);
      }
    };

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await clienteAxios.get('/api/stats/counts', {
          params: { keys: keys.join(',') },
        });
        if (cancelled) return;
        const serverCounts = data?.counts || {};
        // Si algún id no lo resuelve el batch, completar con el fallback puntual
        const missing = keys.filter((id) => serverCounts[id] == null && endpoints[id]);
        if (missing.length === 0) {
          setCounts(serverCounts);
          setLoading(false);
          return;
        }
        const extra = await Promise.all(
          missing.map(async (id) => {
            try {
              const { data: d } = await clienteAxios.get(endpoints[id], {
                params: { limit: 1, page: 1 },
              });
              return [id, extractSectionTotal(d)];
            } catch (err) {
              return [id, null];
            }
          }),
        );
        if (!cancelled) {
          setCounts({ ...serverCounts, ...Object.fromEntries(extra) });
          setLoading(false);
        }
      } catch (err) {
        if (isAxiosCanceled(err)) return;
        // El endpoint batch no está disponible: usar el modo por endpoint
        await loadPerEndpoint();
      }
    };

    load();
    return () => { cancelled = true; };
  }, [endpoints]);

  return { counts, loading };
}
