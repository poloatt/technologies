import { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubLabelSx, hubPeriodSx } from '../../hub';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
import LedgerKindFilter from '../transacciones/LedgerKindFilter';
import { DOLAR_TYPE_FILTERS, kindsQueryFor } from '../transacciones/ledgerKindFilters';
import {
  DEFAULT_PERIOD_PRESET,
  formatMonto,
  formatPeriodSpan,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';

const EMPTY_MONEDA = {
  monedaId: null,
  simbolo: '$',
  color: '#F9A825',
  usdVendido: 0,
  usdComprado: 0,
  pesosVenta: 0,
  pesosCompra: 0,
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

function formatUsd(monto, showValues, signed = true) {
  if (!showValues) return 'U$D ••••';
  const n = Number(monto) || 0;
  const body = Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!signed) return `U$D ${body}`;
  if (n < 0) return `−U$D ${body}`;
  if (n > 0) return `+U$D ${body}`;
  return `U$D ${body}`;
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

export default function DolaresResumen({
  density = 'page',
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
  enabledKinds,
  onKindsChange,
}) {
  const dense = density === 'compact';
  const { showValues } = useValuesVisibility();
  const [hubPreset, setHubPreset] = useState(DEFAULT_PERIOD_PRESET);
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
    ledger: 'dolares',
    kinds: kindsQueryFor(DOLAR_TYPE_FILTERS, kindSelection),
  });

  const activa = stats.porMoneda?.[0] || EMPTY_MONEDA;
  const simbolo = activa.simbolo || '$';
  const vendido = Number(activa.usdVendido) || 0;
  const comprado = Number(activa.usdComprado) || 0;
  // Vender dólares deja pesos a favor. Comprar los saca.
  const netoUsd = vendido - comprado;
  const pesosVenta = pesoEntero(activa.pesosVenta || 0);
  const pesosCompra = pesoEntero(activa.pesosCompra || 0);
  const recibido = pesosVenta - pesosCompra;
  const resultadoColor = netoUsd < 0 ? 'error.main' : (activa.color || 'success.main');

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
            {formatUsd(netoUsd, showValues)}
          </Typography>
          {dense && (
            <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0, flexShrink: 0, textAlign: 'right' }}>
              {span}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, mt: dense ? 1 : 1.5 }}>
          <Metric
            label="Recibido"
            amount={conSigno(recibido, simbolo, showValues)}
            color={recibido < 0 ? 'error.main' : undefined}
          />
          <Metric
            label="Vendido"
            amount={conSigno(pesosVenta, simbolo, showValues)}
          />
          <Metric
            label="Comprado"
            amount={conSigno(pesosCompra, simbolo, showValues)}
          />
        </Box>
      </>
    );
  }

  return (
    <Box
      component="section"
      aria-label="Dólares del período"
      sx={dense ? undefined : { mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.375 : 0.5, mb: dense ? 1 : 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', minHeight: 28 }}>
          <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
            <PeriodControl preset={activePreset} onChange={changePreset} />
          </Box>
          <LedgerKindFilter
            options={DOLAR_TYPE_FILTERS}
            enabledIds={kindSelection}
            onChange={setKindSelection}
          />
        </Box>
        {!dense && (
          <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0 }}>
            {span}
          </Typography>
        )}
      </Box>
      {body}
    </Box>
  );
}
