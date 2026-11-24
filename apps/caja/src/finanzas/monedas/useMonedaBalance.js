import { useEffect, useState } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import { formatDateKey } from '../transacciones/transaccionesPeriodUtils';

export function useMonedaBalance(monedaId) {
  const [balance, setBalance] = useState(0);

  const { data, loading, error } = useAPI(
    monedaId ? `/api/monedas/${monedaId}/balance` : null,
    {
      params: {
        fechaFin: formatDateKey(new Date()),
        estado: 'PAGADO',
      },
      dependencies: [monedaId],
      enableCache: true,
      cacheDuration: 120000,
    },
  );

  useEffect(() => {
    if (data) setBalance(data.balance || 0);
  }, [data]);

  return { balance, loading: loading && !!monedaId, error };
}
