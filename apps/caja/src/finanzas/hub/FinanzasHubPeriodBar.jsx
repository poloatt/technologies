import { Box, Typography } from '@mui/material';
import { hubEyebrowSx } from '@shared/tipografia';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import {
  FLUJO_PERIOD_MODES,
  formatPeriodSpan,
  getPeriodRange,
} from '../transacciones/transaccionesPeriodUtils';
import { useCuentaMostrada } from '../cuentas/useCuentaMostrada';
import { useFinanzasHubPeriod } from './finanzasHubPeriod';

/**
 * Una sola barra de período, bajo el header, para todo el hub.
 * El selector (tipo + gráfico de barras) ocupa todo el ancho; el rango de
 * fechas se muestra una vez, a la derecha de la fila del selector.
 */
export default function FinanzasHubPeriodBar() {
  const hubPeriod = useFinanzasHubPeriod();
  const { cuenta } = useCuentaMostrada();
  if (!hubPeriod) return null;

  const range = getPeriodRange(hubPeriod.preset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);

  return (
    <Box sx={{ pt: 1, mb: 1.5 }}>
      <PeriodControl
        preset={hubPeriod.preset}
        onChange={hubPeriod.setPreset}
        modes={FLUJO_PERIOD_MODES}
        cuentaId={cuenta?.id || cuenta?._id}
        trailing={span ? (
          <Typography
            variant="caption"
            aria-label="Rango del período"
            sx={{
              ...hubEyebrowSx,
              mb: 0,
              display: 'block',
              lineHeight: '28px',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {span}
          </Typography>
        ) : null}
      />
    </Box>
  );
}
