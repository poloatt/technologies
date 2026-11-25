import { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useAPI } from '@shared/hooks/useAPI';
import { filterToggleRowSx, getFilterToggleHubRowSx } from '@shared/styles/filterToggleStyles';
import { hubPeriodSx } from '../../hub';
import FilterToggleButton from '../FilterToggleButton';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
import { focusKindId } from '../transacciones/ledgerKindFilters';
import {
  DEFAULT_PERIOD_PRESET,
  formatPeriodSpan,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';

const EMPTY_MONEDA = {
  monedaId: null,
  simbolo: '$',
  color: '#F9A825',
  usdVendido: 0,
  usdComprado: 0,
  usdRecibido: 0,
  usdEnviado: 0,
  usdPagado: 0,
};

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

export default function DolaresResumen({
  density = 'page',
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
  enabledKinds,
  onKindsChange,
}) {
  const { showValues } = useValuesVisibility();
  const { dense, activePreset, changePreset, showPeriodControl } = useSectionPeriod({
    density,
    preset,
    onPresetChange,
  });
  const [localKinds, setLocalKinds] = useState(null);
  const controlledKinds = typeof onKindsChange === 'function';
  const kindSelection = controlledKinds ? enabledKinds : localKinds;
  const setKindSelection = controlledKinds ? onKindsChange : setLocalKinds;
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    ledger: 'dolares',
  });

  const activa = stats.porMoneda?.[0] || EMPTY_MONEDA;
  const vendido = Number(activa.usdVendido) || 0;
  const comprado = Number(activa.usdComprado) || 0;
  const recibido = Number(activa.usdRecibido) || 0;
  const enviado = Number(activa.usdEnviado) || 0;
  const pagos = Number(activa.usdPagado) || 0;
  const groups = [
    { id: 'move', label: 'Movimientos', neto: recibido - enviado },
    { id: 'card', label: 'Pagos', neto: -pagos },
    { id: 'fx', label: 'Compraventa', neto: comprado - vendido },
  ];
  const selectedIds = kindSelection == null ? groups.map((group) => group.id) : kindSelection;
  const netoUsd = groups
    .filter((group) => selectedIds.includes(group.id))
    .reduce((acc, group) => acc + group.neto, 0);
  const { data: monedasData } = useAPI('/api/monedas');
  const usdColor = (monedasData?.docs || []).find((moneda) => moneda.codigo === 'USD')?.color;
  const resultadoColor = netoUsd < 0 ? 'error.main' : (usdColor || '#006400');

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
        {dense && <HubBalanceDivider />}
        <Box sx={dense ? getFilterToggleHubRowSx() : { ...filterToggleRowSx, mt: 1.5 }}>
          {groups.map((group) => (
            <FilterToggleButton
              key={group.id}
              label={group.label}
              amount={formatUsd(group.neto, showValues)}
              amountColor={group.neto < 0 ? 'error.main' : (group.neto > 0 ? (usdColor || 'text.primary') : 'text.secondary')}
              selected={Array.isArray(kindSelection) && kindSelection.includes(group.id)}
              onClick={() => setKindSelection(focusKindId(kindSelection, group.id))}
            />
          ))}
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
      {(showPeriodControl || !dense) && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.375 : 0.5, mb: dense ? 1 : 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: showPeriodControl ? 'flex-start' : 'flex-end',
            gap: 0.5,
            width: '100%',
            minHeight: 28,
          }}
        >
          {showPeriodControl && (
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <PeriodControl preset={activePreset} onChange={changePreset} />
            </Box>
          )}
        </Box>
        {!dense && (
          <Typography variant="caption" sx={{ ...hubPeriodSx, mb: 0 }}>
            {span}
          </Typography>
        )}
      </Box>
      )}
      {body}
    </Box>
  );
}
