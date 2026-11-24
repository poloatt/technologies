import { useMemo } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import {
  DEFAULT_PERIOD_PRESET,
  getPeriodLabel,
  getPeriodRange,
} from './transaccionesPeriodUtils';

/**
 * Totales y serie del período. `preset` y `cuentaId` son primitivos: un objeto
 * inline en el caller invalidaba el memo en cada render.
 * Los totales de la moneda activa no mezclan divisas; `ingresos`/`egresos` de
 * la respuesta cruda siguen siendo la suma histórica para consumidores viejos.
 */
export function useTransaccionesPeriodStats({
  preset = DEFAULT_PERIOD_PRESET,
  cuentaId,
  ledger,
  kinds,
} = {}) {
  const params = useMemo(() => {
    const range = getPeriodRange(preset);
    const next = ledger ? { ...range, ledger } : { ...range };
    if (cuentaId) next.cuenta = cuentaId;
    if (kinds) next.kinds = kinds;
    return next;
  }, [preset, cuentaId, ledger, kinds]);

  const { data, loading, error, refetch } = useAPI('/api/transacciones/stats', {
    params,
    enableCache: true,
    cacheDuration: 60000,
  });

  const requestedCuenta = params.cuenta || null;
  const requestedLedger = params.ledger || 'flujo';
  const requestedKinds = params.kinds || null;
  const rangeMatches = !!data
    && data.fechaInicio === params.fechaInicio
    && data.fechaFin === params.fechaFin
    && (data.cuenta || null) === requestedCuenta
    && (data.ledger || 'flujo') === requestedLedger
    && (data.kinds || null) === requestedKinds;

  const stats = useMemo(() => {
    if (!rangeMatches) {
      return {
        porMoneda: [],
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
      };
    }
    const porMoneda = [...(data.porMoneda ?? [])].sort(
      (a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos),
    );
    return {
      porMoneda,
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
    };
  }, [data, rangeMatches, params.fechaInicio, params.fechaFin]);

  return {
    stats,
    loading: !rangeMatches && (loading || !error),
    error: rangeMatches ? null : error,
    refetch,
    periodLabel: getPeriodLabel(preset),
    preset,
  };
}
