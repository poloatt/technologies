import { useEffect, useMemo, useRef } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import { formatDateKey } from '../transacciones/transaccionesPeriodUtils';

export function useCuentaBalance(cuentaId, { fechaFin } = {}) {
  const effectiveFechaFin = fechaFin || formatDateKey(new Date());

  const params = useMemo(
    () => ({
      fechaFin: effectiveFechaFin,
      estado: 'PAGADO',
    }),
    [effectiveFechaFin],
  );

  // Usa el endpoint de agregación en vez de bajar hasta 5000 transacciones
  const { data, loading, error, refetch } = useAPI(
    cuentaId ? `/api/transacciones/balance/${cuentaId}` : null,
    {
      params,
      dependencies: [cuentaId, effectiveFechaFin],
      enableCache: true,
      cacheDuration: 120000,
    },
  );

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!cuentaId) return undefined;
    const onRefresh = () => refetchRef.current();
    window.addEventListener('transaccionesRefreshed', onRefresh);
    return () => window.removeEventListener('transaccionesRefreshed', onRefresh);
  }, [cuentaId]);

  const balance = data?.balance ?? 0;
  const porMoneda = useMemo(() => (Array.isArray(data?.porMoneda) ? data.porMoneda : []), [data]);
  const balanceByMonedaId = useMemo(() => {
    const map = {};
    for (const item of porMoneda) {
      if (item?.monedaId) {
        map[String(item.monedaId)] = item.balance ?? 0;
      }
    }
    return map;
  }, [porMoneda]);

  return {
    balance,
    porMoneda,
    balanceByMonedaId,
    loading: loading && !!cuentaId,
    error,
    refetch,
  };
}
