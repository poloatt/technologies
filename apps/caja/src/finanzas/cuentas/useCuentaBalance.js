import { useAPI } from '@shared/hooks/useAPI';

export function useCuentaBalance(cuentaId) {
  const today = new Date().toISOString().split('T')[0];

  // Usa el endpoint de agregación en vez de bajar hasta 5000 transacciones
  const { data, loading, error } = useAPI(
    cuentaId ? `/api/transacciones/balance/${cuentaId}` : null,
    {
      params: {
        fechaFin: today,
        estado: 'PAGADO',
      },
      dependencies: [cuentaId],
      enableCache: true,
      cacheDuration: 120000,
    },
  );

  const balance = data?.balance ?? 0;

  return { balance, loading: loading && !!cuentaId, error };
}
