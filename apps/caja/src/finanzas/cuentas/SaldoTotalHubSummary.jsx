import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material';
import { useAPI } from '@shared/hooks/useAPI';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { HubBalanceBreakdown } from '@shared/components/hub';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import {
  DEFAULT_PERIOD_PRESET,
  formatMonto,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';

/** Cantidad de monedas que muestra el resumen (las primeras según el orden del usuario). */
const MONEDAS_VISIBLES = 3;

/**
 * Saldo real por moneda de todas las cuentas (Mercado Pago, bancos, Efectivo, etc.)
 * al cierre del período seleccionado en el hub Finanzas. Va debajo del título Cuentas.
 */
export default function SaldoTotalHubSummary({ preset = DEFAULT_PERIOD_PRESET } = {}) {
  const theme = useTheme();
  const { showValues } = useValuesVisibility();
  const { activePreset } = useSectionPeriod({ density: 'compact', preset });
  const { fechaFin } = getPeriodRange(activePreset);

  const params = useMemo(() => ({ fechaFin }), [fechaFin]);
  const { data, loading, error, refetch } = useAPI('/api/transacciones/saldos-totales', {
    params,
    dependencies: [fechaFin],
    enableCache: true,
    cacheDuration: 60000,
  });

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    const onRefresh = () => refetchRef.current();
    window.addEventListener('transaccionesRefreshed', onRefresh);
    window.addEventListener('cuentasRefreshed', onRefresh);
    window.addEventListener('monedasRefreshed', onRefresh);
    return () => {
      window.removeEventListener('transaccionesRefreshed', onRefresh);
      window.removeEventListener('cuentasRefreshed', onRefresh);
      window.removeEventListener('monedasRefreshed', onRefresh);
    };
  }, []);

  const expense = theme.palette.error.main;
  const items = useMemo(
    () => (Array.isArray(data?.porMoneda) ? data.porMoneda : [])
      .slice(0, MONEDAS_VISIBLES)
      .map((moneda) => ({
        id: moneda.monedaId,
        label: moneda.codigo,
        amount: formatMonto(moneda.balance, moneda.simbolo, showValues),
        color: moneda.balance < 0 ? expense : (moneda.balance > 0 ? moneda.color : undefined),
        title: 'Saldo total de todas las cuentas',
      })),
    [data, showValues, expense],
  );

  if (!loading && !error && items.length === 0) return null;

  return (
    <HubBalanceBreakdown
      open
      items={items}
      loading={loading}
      error={Boolean(error)}
      sx={{
        px: 0,
        pt: 0.75,
        pb: 1,
        mb: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    />
  );
}
