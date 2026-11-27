import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { hubEyebrowSx } from '@shared/tipografia';
import HubBalanceDivider from '../hub/HubBalanceDivider';
import FinanzasPagePeriodHeader, { finanzasPageSummarySectionSx } from '../FinanzasPagePeriodHeader';
import { HubBalanceLead, HubBalanceRow } from '@shared/components/hub';
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
  cuentaId,
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
}) {
  const { showValues } = useValuesVisibility();
  const { nombre: cuentaNombre, hubNombre } = useCuentaMostrada(cuentaId);
  const { dense, activePreset, changePreset, showPeriodControl } = useSectionPeriod({
    density,
    preset,
    onPresetChange,
  });
  const range = getCreditosPeriodRange(activePreset);
  const span = formatCreditosPeriodSpan(activePreset, range.fechaInicio, range.fechaFin);
  const { stats, loading, error } = useTransaccionesPeriodStats({
    preset: activePreset,
    cuentaId,
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
        <Skeleton
          height={dense ? 22 : 34}
          width={dense ? 140 : 120}
          sx={{ mb: 1, borderRadius: 0.5, ...(dense ? null : { mx: 'auto' }) }}
        />
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
            amount={formatMonto(saldo, simbolo, showValues)}
            color={resultadoColor}
            dense
            below={(showPeriodControl || activePreset === 'ytg') ? (
              // En el hub el período va junto al selector; acá solo YTG, que no cierra en diciembre.
              <Typography variant="caption" sx={{ ...hubEyebrowSx, display: 'block', mb: 0, textAlign: 'right' }}>
                {span}
              </Typography>
            ) : null}
          />
          <HubBalanceDivider />
        </>
      ) : (
        <HubBalanceLead
          amount={formatMonto(saldo, simbolo, showValues)}
          color={resultadoColor}
          dense={false}
        />
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.75 : 1.25, mt: dense ? 0 : 1.75 }}>
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
      aria-label="Tarjeta del período"
      sx={dense ? undefined : finanzasPageSummarySectionSx}
    >
      {!dense ? (
        <FinanzasPagePeriodHeader
          title="Tarjeta"
          subtitle={cuentaId ? cuentaNombre : null}
          preset={activePreset}
          onChange={changePreset}
          span={span}
          cuentaId={cuentaId}
          ledger="creditos"
        />
      ) : showPeriodControl && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 28 }}>
            <PeriodControl
              preset={activePreset}
              onChange={changePreset}
              cuentaId={cuentaId}
              ledger="creditos"
            />
          </Box>
        </Box>
      )}
      {body}
    </Box>
  );
}
