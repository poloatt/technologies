import { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useAPI } from '@shared/hooks/useAPI';
import { filterTogglePageRowSx, getFilterToggleHubRowSx } from '@shared/styles/filterToggleStyles';
import { hubEyebrowSx } from '@shared/tipografia';
import FilterToggleButton from '../FilterToggleButton';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import FinanzasPagePeriodHeader, { finanzasPageSummarySectionSx } from '../FinanzasPagePeriodHeader';
import { HubBalanceLead, HubBalanceRow } from '@shared/components/hub';
import { useCuentaMostrada } from '../cuentas/useCuentaMostrada';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
import { DEFAULT_USD_COLOR } from '../monedas/monedaConstants';
import { DOLAR_TYPE_FILTERS, focusKindId, kindsQueryFor } from '../transacciones/ledgerKindFilters';
import {
  DEFAULT_PERIOD_PRESET,
  formatPeriodSpan,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';

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
  const [localKinds, setLocalKinds] = useState(null);
  const controlledKinds = typeof onKindsChange === 'function';
  const kindSelection = controlledKinds ? enabledKinds : localKinds;
  const setKindSelection = controlledKinds ? onKindsChange : setLocalKinds;
  const range = getPeriodRange(activePreset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    cuentaId,
    ledger: 'dolares',
  });

  // Totales de toda la cuenta en USD. No se usa porMoneda[0]: ahí caen pesos y dólares mezclados.
  const vendido = Number(stats.usdVendido) || 0;
  const comprado = Number(stats.usdComprado) || 0;
  const recibido = Number(stats.usdRecibido) || 0;
  const enviado = Number(stats.usdEnviado) || 0;
  const pagos = Number(stats.usdPagado) || 0;
  const rendimientos = Number(stats.usdRendimientos) || 0;
  const groups = [
    { id: 'move', label: 'Movimientos', neto: recibido + rendimientos - enviado },
    { id: 'card', label: 'Pagos', neto: -pagos },
    { id: 'fx', label: 'Compraventa', neto: comprado - vendido },
  ];
  const selectedIds = kindSelection == null ? groups.map((group) => group.id) : kindSelection;
  const netoUsd = groups
    .filter((group) => selectedIds.includes(group.id))
    .reduce((acc, group) => acc + group.neto, 0);
  const { data: monedasData } = useAPI('/api/monedas');
  const usdColor = (monedasData?.docs || []).find((moneda) => moneda.codigo === 'USD')?.color || DEFAULT_USD_COLOR;
  const resultadoColor = netoUsd < 0 ? 'error.main' : usdColor;
  const chartKinds = kindsQueryFor(DOLAR_TYPE_FILTERS, kindSelection);

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
              amount={formatUsd(netoUsd, showValues)}
              color={resultadoColor}
              dense
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
            amount={formatUsd(netoUsd, showValues)}
            color={resultadoColor}
            dense={false}
          />
        )}
        <Box sx={dense ? getFilterToggleHubRowSx() : filterTogglePageRowSx}>
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
      sx={dense ? undefined : finanzasPageSummarySectionSx}
    >
      {!dense ? (
        <FinanzasPagePeriodHeader
          title="Dólares"
          subtitle={cuentaId ? cuentaNombre : null}
          preset={activePreset}
          onChange={changePreset}
          span={span}
          cuentaId={cuentaId}
          positiveColor={usdColor}
          ledger="dolares"
          kinds={chartKinds}
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
                positiveColor={usdColor}
                ledger="dolares"
                kinds={chartKinds}
              />
            </Box>
          </Box>
        </Box>
      )}
      {body}
    </Box>
  );
}
