import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material';
import { useAPI } from '@shared/hooks/useAPI';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { HubAccountBlock } from '@shared/components/hub';
import { useCajaSetup } from '../../atta/useCajaSetup';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import {
  DEFAULT_PERIOD_PRESET,
  formatMonto,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';
import { getMonedasFromCuenta, isCuentaMultimoneda } from './cuentaConstants';
import { useCuentaBalance } from './useCuentaBalance';

/**
 * Bloque de la cuenta Efectivo por defecto en la tarjeta Cuentas del hub.
 * Usa la misma definición visual única (`HubAccountBlock` en @shared) que MERCADOPAGO POLOATTA:
 *  - Arriba: flujo neto del período (mismo selector de período del hub).
 *  - Desglose: saldo al cierre del período por cada moneda habilitada, con su símbolo y color.
 */
export default function EfectivoHubSummary({ preset = DEFAULT_PERIOD_PRESET } = {}) {
  const theme = useTheme();
  const { openSetup } = useCajaSetup();
  const { showValues } = useValuesVisibility();
  const { dense, activePreset } = useSectionPeriod({
    density: 'compact',
    preset,
  });
  const range = getPeriodRange(activePreset);
  const { data: cuentasData, loading: cuentasLoading, refetch: refetchCuentas } = useAPI('/api/cuentas', {
    enableCache: true,
    cacheDuration: 60000,
  });
  const { data: monedasData, refetch: refetchMonedas } = useAPI('/api/monedas', {
    enableCache: true,
    cacheDuration: 60000,
    params: { sort: 'orden', limit: 200 },
  });

  const cuentas = useMemo(
    () => cuentasData?.docs ?? (Array.isArray(cuentasData) ? cuentasData : []),
    [cuentasData],
  );
  const monedasCatalog = useMemo(
    () => monedasData?.docs ?? (Array.isArray(monedasData) ? monedasData : []),
    [monedasData],
  );

  const cuentaEfectivo = useMemo(
    () =>
      cuentas.find((c) => c.esDefault && c.tipo === 'EFECTIVO')
      || cuentas.find((c) => isCuentaMultimoneda(c))
      || cuentas.find((c) => c.tipo === 'EFECTIVO')
      || null,
    [cuentas],
  );

  const efectivoId = cuentaEfectivo?.id || cuentaEfectivo?._id || null;

  const {
    balanceByMonedaId,
    loading: balanceLoading,
    error: balanceError,
  } = useCuentaBalance(efectivoId, { fechaFin: range.fechaFin });

  const refetchCuentasRef = useRef(refetchCuentas);
  const refetchMonedasRef = useRef(refetchMonedas);
  refetchCuentasRef.current = refetchCuentas;
  refetchMonedasRef.current = refetchMonedas;

  useEffect(() => {
    const onAccountsOrCurrencies = () => {
      refetchCuentasRef.current();
      refetchMonedasRef.current();
    };
    window.addEventListener('cuentasRefreshed', onAccountsOrCurrencies);
    window.addEventListener('monedasRefreshed', onAccountsOrCurrencies);
    return () => {
      window.removeEventListener('cuentasRefreshed', onAccountsOrCurrencies);
      window.removeEventListener('monedasRefreshed', onAccountsOrCurrencies);
    };
  }, []);

  const monedasHabilitadas = useMemo(
    () => getMonedasFromCuenta(cuentaEfectivo, monedasCatalog),
    [cuentaEfectivo, monedasCatalog],
  );

  const expense = theme.palette.error.main;
  const saldoColor = (valor, accent) => {
    if (valor < 0) return expense;
    return valor > 0 ? accent : undefined;
  };

  const destino = useMemo(
    () => (efectivoId ? () => openSetup('cuentas', { cuentaId: efectivoId }) : undefined),
    [efectivoId, openSetup],
  );

  const breakdownItems = useMemo(
    () =>
      monedasHabilitadas.map((moneda) => {
        const valor = balanceByMonedaId[moneda.id] ?? 0;
        return {
          id: moneda.id,
          label: moneda.codigo || moneda.nombre,
          amount: formatMonto(valor, moneda.simbolo, showValues),
          color: saldoColor(valor, moneda.color),
          title: `${moneda.nombre} (${moneda.simbolo})`,
          onClick: destino,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monedasHabilitadas, balanceByMonedaId, showValues, destino, expense],
  );

  if (!cuentasLoading && !cuentaEfectivo) {
    return null;
  }

  return (
    <HubAccountBlock
      cuenta={cuentaEfectivo?.nombre || 'Efectivo'}
      showHero={false}
      dense={dense}
      loading={cuentasLoading}
      breakdownItems={breakdownItems}
      breakdownLoading={cuentasLoading || balanceLoading}
      breakdownError={Boolean(balanceError)}
    />
  );
}
