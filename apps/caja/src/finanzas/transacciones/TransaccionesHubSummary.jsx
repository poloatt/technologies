import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import {
  CAJA_HUB_CHIP,
  getHubChipSx,
  hubCarouselSx,
  hubPeriodSx,
  hubValueSx,
  hubLabelSx,
} from '../../hub';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { HubMetricsRow, MetricChip } from '../../hub';
import { formatMonto } from './transaccionesPeriodUtils';
import { useTransaccionesPeriodStats } from './useTransaccionesPeriodStats';

export function TransaccionesHubSummarySkeleton() {
  return (
    <Box>
      <Skeleton height={12} width={64} sx={{ mb: 0.375, borderRadius: 0.5 }} />
      <HubMetricsRow>
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={CAJA_HUB_CHIP.chipHeight}
            sx={{ ...getHubSubsectionSx(), flex: 1, height: CAJA_HUB_CHIP.chipHeight }}
          />
        ))}
      </HubMetricsRow>
    </Box>
  );
}

/** Resumen ingresos / gastos / balance del mes (mismo lenguaje visual que tiles de Monedas). */
export default function TransaccionesHubSummary() {
  const { showValues } = useValuesVisibility();
  const { stats, loading, periodLabel } = useTransaccionesPeriodStats();

  if (loading) return <TransaccionesHubSummarySkeleton />;

  const monedas = stats.porMoneda?.length ? stats.porMoneda : [{
    simbolo: '$',
    color: '#4CAF50',
    ingresos: stats.ingresos,
    egresos: stats.egresos,
    balance: stats.balance,
  }];

  if (monedas.length > 1) {
    return (
      <Box>
        <Typography variant="caption" sx={hubPeriodSx}>
          {periodLabel}
        </Typography>
        <Box sx={hubCarouselSx}>
          {monedas.map((m) => {
            const accent = m.color || '#4CAF50';
            return (
              <Box
                key={m.monedaId || m.codigo}
                sx={{
                  ...getHubChipSx(),
                  flex: '0 0 auto',
                  minWidth: 132,
                  scrollSnapAlign: 'start',
                }}
              >
                <Typography variant="caption" noWrap sx={hubLabelSx}>
                  {m.codigo}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.125 }}>
                  <Typography variant="caption" noWrap sx={{ ...hubValueSx, mt: 0, color: accent, flex: 1 }}>
                    +{formatMonto(m.ingresos, m.simbolo, showValues)}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ ...hubValueSx, mt: 0, color: 'error.main', flex: 1 }}>
                    −{formatMonto(m.egresos, m.simbolo, showValues)}
                  </Typography>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      ...hubValueSx,
                      mt: 0,
                      flex: 1,
                      color: m.balance >= 0 ? accent : 'error.main',
                    }}
                  >
                    {formatMonto(m.balance, m.simbolo, showValues)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  const m = monedas[0];
  const simbolo = m.simbolo || '$';
  const accent = m.color || '#4CAF50';

  return (
    <Box>
      <Typography variant="caption" sx={hubPeriodSx}>
        {periodLabel}
      </Typography>
      <HubMetricsRow>
        <MetricChip
          label="Ingresos"
          value={`+${formatMonto(m.ingresos, simbolo, showValues)}`}
          color={accent}
        />
        <MetricChip
          label="Gastos"
          value={`−${formatMonto(m.egresos, simbolo, showValues)}`}
          color="error.main"
        />
        <MetricChip
          label="Balance"
          value={formatMonto(m.balance, simbolo, showValues)}
          color={m.balance >= 0 ? accent : 'error.main'}
        />
      </HubMetricsRow>
    </Box>
  );
}
