import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubEyebrowSx } from '../../hub';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import { HubBalanceRow } from '@shared/components/hub';
import { useCuentaMostrada } from '../cuentas/useCuentaMostrada';
import { useSectionPeriod } from '../hub/finanzasHubPeriod';
import { PeriodControl, ProportionTrack } from '../transacciones/TransaccionesFlujoVisual';
import { useTransaccionesPeriodStats } from '../transacciones/useTransaccionesPeriodStats';
import {
  DEFAULT_PERIOD_PRESET,
  formatMonto,
  formatCreditosPeriodSpan,
  getCreditosPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';

const EMPTY_MONEDA = {
  simbolo: '$',
  cuotas: 0,
};

export default function CreditosResumen({
  density = 'page',
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
}) {
  const { showValues } = useValuesVisibility();
  const { nombre: cuentaNombre } = useCuentaMostrada();
  const { dense, activePreset, changePreset, showPeriodControl } = useSectionPeriod({
    density,
    preset,
    onPresetChange,
  });
  const range = getCreditosPeriodRange(activePreset);
  const span = formatCreditosPeriodSpan(activePreset, range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    ledger: 'creditos',
  });

  const theme = useTheme();
  const activa = stats.porMoneda?.[0] || EMPTY_MONEDA;
  const simbolo = activa.simbolo || '$';
  const gastado = Number(activa.cuotas) || 0;
  const pagado = Number(activa.pagado) || 0;
  const saldo = pagado - gastado;
  const accent = activa.color || '#5C6BC0';
  const expense = theme.palette.error.main;
  const resultadoColor = saldo < 0 ? expense : (saldo === 0 ? 'text.primary' : accent);
  const maxBar = Math.max(pagado, gastado, 0);

  let body;
  if (loading) {
    body = (
      <Box>
        <Skeleton height={dense ? 22 : 36} width={140} sx={{ mb: 1, borderRadius: 0.5 }} />
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
      <HubBalanceRow
        cuenta={cuentaNombre}
        amount={formatMonto(saldo, simbolo, showValues)}
        color={resultadoColor}
        dense={dense}
        below={dense && (showPeriodControl || activePreset === 'ytg') ? (
          // En el hub el período va junto al selector; acá solo YTG, que no cierra en diciembre.
          <Typography variant="caption" sx={{ ...hubEyebrowSx, display: 'block', mb: 0, textAlign: 'right' }}>
            {span}
          </Typography>
        ) : null}
      />
      {dense && <HubBalanceDivider />}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.75 : 1.25, mt: dense ? 0 : 1.5 }}>
        <ProportionTrack
          label="Pagado"
          amount={`+${formatMonto(pagado, simbolo, showValues)}`}
          value={pagado}
          max={maxBar}
          color={accent}
          dense={dense}
        />
        <ProportionTrack
          label="Gastado"
          amount={`−${formatMonto(gastado, simbolo, showValues)}`}
          value={gastado}
          max={maxBar}
          color={expense}
          dense={dense}
        />
      </Box>
      </>
    );
  }

  return (
    <Box
      component="section"
      aria-label="Créditos del período"
      sx={dense ? undefined : { mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      {(showPeriodControl || !dense) && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.375 : 0.5, mb: dense ? 1 : 1.5 }}>
        {showPeriodControl && (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 28 }}>
            <PeriodControl preset={activePreset} onChange={changePreset} />
          </Box>
        )}
        {!dense && (
          <Typography variant="caption" sx={{ ...hubEyebrowSx, mb: 0 }}>
            {span}
          </Typography>
        )}
      </Box>
      )}
      {body}
    </Box>
  );
}
