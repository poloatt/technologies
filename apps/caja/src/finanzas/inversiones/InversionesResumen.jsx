import { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubLabelSx, hubPeriodSx } from '../../hub';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
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
  rendimientos: 0,
  neto: 0,
};

function netoPhrase(moneda) {
  const moved = moneda.enviado || moneda.rescatado || moneda.rendimientos;
  if (!moved) return 'Sin reservas ni inversiones en este período';
  if (moneda.neto > 0) return 'Volvió más de lo que enviaste';
  if (moneda.neto < 0) return 'Enviaste más de lo que rescataste';
  return 'Envíos y rescates empataron';
}

function Metric({ label, amount, color }) {
  return (
    <Box sx={{ minWidth: 0, flex: '1 1 0' }}>
      <Typography sx={hubLabelSx}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.25, mt: 0.25, color }}>
        {amount}
      </Typography>
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
}) {
  const dense = density === 'compact';
  const { showValues } = useValuesVisibility();
  const [hubPreset, setHubPreset] = useState(DEFAULT_PERIOD_PRESET);
  const [monedaElegida, setMonedaElegida] = useState(null);
  const activePreset = dense ? hubPreset : preset;
  const changePreset = dense ? setHubPreset : onPresetChange;
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    ledger: 'inversiones',
  });

  const monedas = stats.porMoneda;
  const activa = monedas.find((moneda) => moneda.monedaId === monedaElegida) || monedas[0] || EMPTY_MONEDA;
  const simbolo = activa.simbolo || '$';
  const neto = activa.neto ?? (activa.rescatado || 0) + (activa.rendimientos || 0) - (activa.enviado || 0);
  const netoColor = neto < 0 ? 'error.main' : activa.color || '#9C27B0';

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
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: dense ? '1rem' : '1.75rem',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: netoColor,
            mb: dense ? 1 : 0,
          }}
        >
          {formatMonto(neto, simbolo, showValues)}
        </Typography>
        {!dense && (
          <Typography
            variant="body2"
            sx={{ mt: 0.375, mb: 1.5, color: 'text.secondary', fontSize: '0.8125rem' }}
          >
            {netoPhrase(activa)}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Metric label="Enviado" amount={formatMonto(activa.enviado || 0, simbolo, showValues)} />
          <Metric label="Rescatado" amount={formatMonto(activa.rescatado || 0, simbolo, showValues)} />
          <Metric
            label="Rendimientos"
            amount={formatMonto(activa.rendimientos || 0, simbolo, showValues)}
            color={activa.color || 'success.main'}
          />
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
        <PeriodControl preset={activePreset} onChange={changePreset} />
        <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0 }}>
          {span}
          {!dense && monedas.length > 1 ? ` · ${activa.codigo || 'moneda'}` : ''}
        </Typography>
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
