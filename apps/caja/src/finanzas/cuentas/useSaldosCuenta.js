import { useEffect, useMemo } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import { getPeriodRange } from '../transacciones/transaccionesPeriodUtils';

const EMPTY = {
  dineroEnCuenta: 0,
  dineroEnCuentaFuente: 'ledger',
  dineroEnCuentaActualizadoEn: null,
  reservado: 0,
  invertido: 0,
  rendimientos: 0,
  rendimientosPeriodo: 0,
  dolares: 0,
  credito: 0,
  ingresosPeriodo: 0,
  egresosPeriodo: 0,
  flujoPeriodo: 0,
  multimoneda: false,
  porMoneda: [],
};

/**
 * Saldos acumulados de la cuenta Mercado Pago al cierre del período (`preset`).
 * `dineroEnCuenta` es el saldo real de MP cuando hay lectura reciente (`dineroEnCuentaFuente`).
 * `rendimientosPeriodo` es lo acreditado dentro del período, no el acumulado.
 * Solo consulta mientras `enabled`; se refresca cuando cambian las transacciones.
 */
export function useSaldosCuenta({ enabled = true, cuentaId, preset } = {}) {
  const params = useMemo(() => {
    const next = {};
    if (cuentaId) next.cuenta = cuentaId;
    if (preset) {
      const range = getPeriodRange(preset);
      next.fechaInicio = range.fechaInicio;
      next.fechaFin = range.fechaFin;
    }
    return next;
  }, [cuentaId, preset]);

  const { data, loading, error, refetch } = useAPI(
    enabled ? '/api/transacciones/saldos' : null,
    {
      params,
      enableCache: true,
      cacheDuration: 60000,
    },
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const onRefresh = () => refetch();
    window.addEventListener('transaccionesRefreshed', onRefresh);
    return () => window.removeEventListener('transaccionesRefreshed', onRefresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refetch]);

  const rangeMatches = !preset || (
    !!data
    && data.fechaInicio === params.fechaInicio
    && data.fechaFin === params.fechaFin
  );

  return {
    saldos: data && rangeMatches ? { ...EMPTY, ...data } : null,
    loading: enabled && (!rangeMatches ? (loading || !error) : loading),
    error: enabled ? error : null,
  };
}
