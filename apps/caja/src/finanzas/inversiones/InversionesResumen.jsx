import { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { filterTogglePageRowSx, getFilterToggleHubRowSx } from '@shared/styles/filterToggleStyles';
import { hubLabelSx } from '../../hub';
import { hubEyebrowSx } from '@shared/tipografia';
import FilterToggleButton from '../FilterToggleButton';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import FinanzasPagePeriodHeader, { finanzasPageSummarySectionSx } from '../FinanzasPagePeriodHeader';
import { HubBalanceLead, HubBalanceRow } from '@shared/components/hub';
import { useCuentaMostrada } from '../cuentas/useCuentaMostrada';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
import { focusKindId, inversionListQuery } from '../transacciones/ledgerKindFilters';
import {
  DEFAULT_PERIOD_PRESET,
  formatMonto,
  formatPeriodSpan,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';

const EMPTY_MONEDA = {
  monedaId: null,
  codigo: '',
  simbolo: '$',
  color: '#9C27B0',
  enviado: 0,
  rescatado: 0,
  ingresado: 0,
  rescatadoInversion: 0,
  rendimientosReserva: 0,
  rendimientosInversion: 0,
  neto: 0,
};

function pesoEntero(monto) {
  const n = Number(monto) || 0;
  const sign = n < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(n));
}

function conSigno(monto, simbolo, showValues) {
  if (!showValues) return formatMonto(monto, simbolo, false);
  const body = formatMonto(Math.abs(monto), simbolo, true);
  if (monto < 0) return `−${body}`;
  if (monto > 0) return `+${body}`;
  return body;
}

/**
 * Totales del libro inversiones: enviado, rescatado, rendimientos y neto del período.
 * `compact` entra en la tarjeta del hub. `page` va arriba del listado.
 */
export default function InversionesResumen({
  density = 'page',
  cuentaId,
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
  enabledKinds,
  onKindsChange,
}) {
  const { showValues } = useValuesVisibility();
  const { nombre: cuentaNombre, hubNombre } = useCuentaMostrada(cuentaId);
  const { dense, activePreset, changePreset, showPeriodControl } = useSectionPeriod({
    density,
    preset,
    onPresetChange,
  });
  const [monedaElegida, setMonedaElegida] = useState(null);
  const [localKinds, setLocalKinds] = useState(null);
  const controlledKinds = typeof onKindsChange === 'function';
  const kindSelection = controlledKinds ? enabledKinds : localKinds;
  const setKindSelection = controlledKinds ? onKindsChange : setLocalKinds;
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    cuentaId,
    ledger: 'inversiones',
  });

  const monedas = stats.porMoneda;
  const activa = monedas.find((moneda) => moneda.monedaId === monedaElegida) || monedas[0] || EMPTY_MONEDA;
  const simbolo = activa.simbolo || '$';
  const reservado = pesoEntero(activa.enviado || 0);
  const volvio = pesoEntero(activa.rescatado || 0);
  const invertido = pesoEntero(activa.ingresado || 0);
  const rescatadoFci = pesoEntero(activa.rescatadoInversion || 0);
  const rendimientoReserva = pesoEntero(activa.rendimientosReserva || 0);
  const rendimientoInversion = pesoEntero(activa.rendimientosInversion || 0);
  const saldoReserva = reservado - volvio;
  const saldoInversion = invertido - rescatadoFci;
  const rendimientos = rendimientoReserva + rendimientoInversion;
  const totalReserva = saldoReserva + rendimientoReserva;
  const totalInversion = saldoInversion + rendimientoInversion;
  // Cada botón muestra el saldo completo de su cuenta (con rendimientos, igual que el hub),
  // así al seleccionarlo coincide con el total de arriba. Rendimientos es informativo.
  const groups = [
    { id: 'reserve', label: 'Reservado', neto: totalReserva },
    { id: 'invest', label: 'Invertido', neto: totalInversion },
    { id: 'yield', label: 'Rendimientos', neto: rendimientos },
  ];
  const selectedIds = kindSelection == null ? null : kindSelection;
  const elegido = selectedIds?.length === 1
    ? groups.find((group) => group.id === selectedIds[0])
    : null;
  // Sin filtro: suma los dos saldos (que ya incluyen sus rendimientos, sin duplicarlos).
  const resultado = elegido ? elegido.neto : totalReserva + totalInversion;
  const monedaColor = activa.color || 'success.main';
  const resultadoColor = resultado < 0 ? 'error.main' : monedaColor;

  let body;
  if (loading) {
    body = (
      <Box>
        <Skeleton
          height={dense ? 22 : 34}
          width={dense ? 140 : 120}
          sx={{ mb: 1, borderRadius: 0.5, ...(dense ? null : { mx: 'auto' }) }}
        />
        <Skeleton height={22} sx={{ borderRadius: 1 }} />
      </Box>
    );
  } else if (error) {
    body = (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        No se pudo cargar el período
      </Typography>
    );
  } else {
    body = (
      <>
        {dense ? (
          <>
            <HubBalanceRow
              cuenta={hubNombre}
              amount={conSigno(resultado, simbolo, showValues)}
              color={resultadoColor}
              dense
              mb={0}
              below={showPeriodControl ? (
                // En el hub Finanzas el período se muestra una sola vez, junto al selector.
                <Typography
                  variant="caption"
                  sx={{ ...hubEyebrowSx, display: 'block', mb: 0, textAlign: 'right' }}
                >
                  {span}
                </Typography>
              ) : null}
            />
            <HubBalanceDivider />
          </>
        ) : (
          <HubBalanceLead
            amount={conSigno(resultado, simbolo, showValues)}
            color={resultadoColor}
            dense={false}
          />
        )}
        <Box sx={dense ? getFilterToggleHubRowSx() : filterTogglePageRowSx}>
          {groups.map((group) => (
            <FilterToggleButton
              key={group.id}
              label={group.label}
              amount={conSigno(group.neto, simbolo, showValues)}
              amountColor={group.neto < 0 ? 'error.main' : (group.neto === 0 ? 'text.primary' : monedaColor)}
              selected={Array.isArray(kindSelection) && kindSelection.includes(group.id)}
              onClick={() => setKindSelection(focusKindId(kindSelection, group.id))}
            />
          ))}
        </Box>
      </>
    );
  }

  const pageTitle = elegido ? elegido.label : 'Inversiones';
  const periodSpan = monedas.length > 1 ? `${span} · ${activa.codigo || 'moneda'}` : span;
  const chartQuery = inversionListQuery(kindSelection);

  return (
    <Box
      component="section"
      aria-label={`${pageTitle} del período`}
      sx={dense ? undefined : finanzasPageSummarySectionSx}
    >
      {!dense ? (
        <FinanzasPagePeriodHeader
          title={pageTitle}
          subtitle={cuentaId ? cuentaNombre : null}
          preset={activePreset}
          onChange={changePreset}
          span={periodSpan}
          cuentaId={cuentaId}
          ledger="inversiones"
          kinds={chartQuery.kinds}
          yieldSide={chartQuery.yieldSide}
          extra={monedas.length > 1 ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {monedas.map((moneda) => (
                <Box
                  key={moneda.monedaId}
                  component="button"
                  type="button"
                  onClick={() => setMonedaElegida(moneda.monedaId)}
                  sx={{
                    ...hubLabelSx,
                    appearance: 'none',
                    border: 0,
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                    px: 0,
                    color: moneda.monedaId === activa.monedaId ? 'text.primary' : 'text.secondary',
                    fontWeight: moneda.monedaId === activa.monedaId ? 700 : 600,
                  }}
                >
                  {moneda.codigo}
                </Box>
              ))}
            </Box>
          ) : null}
        />
      ) : showPeriodControl && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375, mb: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              gap: 0.5,
              width: '100%',
              minHeight: 28,
            }}
          >
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <PeriodControl
                preset={activePreset}
                onChange={changePreset}
                cuentaId={cuentaId}
                ledger="inversiones"
                kinds={chartQuery.kinds}
                yieldSide={chartQuery.yieldSide}
              />
            </Box>
          </Box>
        </Box>
      )}
      {body}
    </Box>
  );
}
