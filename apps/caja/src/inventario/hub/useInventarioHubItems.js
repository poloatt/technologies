import { useMemo } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import { normalizeInventarioItem } from './inventarioHubUtils';

/** Ítems de inventario filtrados por ubicación para tarjetas del hub. */
export function useInventarioHubItems(ubicacion) {
  const { data, loading } = useAPI('/api/inventarios', {
    enableCache: true,
    cacheDuration: 60000,
    params: { ubicacion, limit: 50 },
  });

  const items = useMemo(() => {
    const docs = data?.docs ?? (Array.isArray(data) ? data : []);
    return docs.map(normalizeInventarioItem);
  }, [data]);

  return { items, loading };
}
