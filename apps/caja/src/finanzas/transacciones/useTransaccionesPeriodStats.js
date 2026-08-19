import { useMemo } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import { getCurrentMonthRange } from './transaccionesPeriodUtils';

export function useTransaccionesPeriodStats(overrides = {}) {
  const params = useMemo(
    () => ({ ...getCurrentMonthRange(), ...overrides }),
    [overrides],
  );

  const { data, loading, error, refetch } = useAPI('/api/transacciones/stats', {
    params,
    enableCache: true,
    cacheDuration: 60000,
  });

  const stats = useMemo(() => {
    if (!data) {
      return {
        ingresos: 0,
        egresos: 0,
        balance: 0,
        porMoneda: [],
      };
    }
    return {
      ingresos: data.ingresos ?? data.ingresosMensuales ?? 0,
      egresos: data.egresos ?? data.egresosMensuales ?? 0,
      balance: data.balance ?? data.balanceTotal ?? 0,
      porMoneda: data.porMoneda ?? [],
    };
  }, [data]);

  return { stats, loading, error, refetch, periodLabel: 'Este mes' };
}
