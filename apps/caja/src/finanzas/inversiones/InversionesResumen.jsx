import { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubLabelSx, hubPeriodSx } from '../../hub';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
import LedgerKindFilter from '../transacciones/LedgerKindFilter';
import { INVERSION_TYPE_FILTERS, kindsQueryFor } from '../transacciones/ledgerKindFilters';
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

function Metric({ label, amount, color, yieldText }) {
  return (
    <Box sx={{ minWidth: 0, flex: '1 1 0' }}>
      <Typography sx={hubLabelSx}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.25, mt: 0.25, color }}>
        {amount}
      </Typography>
      {yieldText ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.secondary' }}>
          {yieldText}
        </Typography>
      ) : null}
    </Box>
  );
}

/**
 * Totales del libro inversiones: enviado, rescatado, rendimientos y neto del período.
 * `compact` entra en la tarjeta del hub. `page` va arriba del listado.
 */
export default function InversionesResumen({
  density = 'page',
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
  enabledKinds,
  onKindsChange,
}) {
  const dense = density === 'compact';
  const { showValues } = useValuesVisibility();
  const [hubPreset, setHubPreset] = useState(DEFAULT_PERIOD_PRESET);
  const [monedaElegida, setMonedaElegida] = useState(null);
  const [localKinds, setLocalKinds] = useState(null);
  const controlledKinds = typeof onKindsChange === 'function';
  const kindSelection = controlledKinds ? enabledKinds : localKinds;
  const setKindSelection = controlledKinds ? onKindsChange : setLocalKinds;
  const activePreset = dense ? hubPreset : preset;
  const changePreset = dense ? setHubPreset : onPresetChange;
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    ledger: 'inversiones',
    kinds: kindsQueryFor(INVERSION_TYPE_FILTERS, kindSelection),
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
  const resultado = saldoReserva + saldoInversion + rendimientos;
  const resultadoColor = resultado < 0 ? 'error.main' : (activa.color || 'success.main');

  let body;
  if (loading) {
    body = (
      <Box>
        <Skeleton height={dense ? 22 : 36} width={140} sx={{ mb: 1, borderRadius: 0.5 }} />
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: dense ? 1 : 1.5,
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: dense ? '1rem' : '1.75rem',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: resultadoColor,
            }}
          >
            {conSigno(resultado, simbolo, showValues)}
          </Typography>
          {dense && (
            <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0, flexShrink: 0, textAlign: 'right' }}>
              {span}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Metric
            label="Reservado"
            amount={conSigno(saldoReserva, simbolo, showValues)}
            color={saldoReserva < 0 ? 'error.main' : undefined}
            yieldText={dense ? undefined : `rendimiento ${conSigno(rendimientoReserva, simbolo, showValues)}`}
          />
          <Metric
            label="Invertido"
            amount={conSigno(saldoInversion, simbolo, showValues)}
            color={saldoInversion < 0 ? 'error.main' : undefined}
            yieldText={dense ? undefined : `rendimiento ${conSigno(rendimientoInversion, simbolo, showValues)}`}
          />
          {dense && (
            <Metric
              label="Rendimientos"
              amount={conSigno(rendimientos, simbolo, showValues)}
              color={rendimientos < 0 ? 'error.main' : undefined}
            />
          )}
        </Box>
      </>
    );
  }

  return (
    <Box
      component="section"
      aria-label="Inversiones del período"
      sx={dense ? undefined : { mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.375 : 0.5, mb: dense ? 1 : 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', minHeight: 28 }}>
          <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
            <PeriodControl preset={activePreset} onChange={changePreset} />
          </Box>
          <LedgerKindFilter
            options={INVERSION_TYPE_FILTERS}
            enabledIds={kindSelection}
            onChange={setKindSelection}
          />
        </Box>
        {!dense && (
          <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0 }}>
            {span}
            {monedas.length > 1 ? ` · ${activa.codigo || 'moneda'}` : ''}
          </Typography>
        )}
        {!dense && monedas.length > 1 && (
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
        )}
      </Box>
      {body}
    </Box>
  );
}
