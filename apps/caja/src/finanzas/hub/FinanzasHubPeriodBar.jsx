import { Box, Typography } from '@mui/material';
import { hubEyebrowSx } from '../../hub';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { formatPeriodSpan, getPeriodRange } from '../transacciones/transaccionesPeriodUtils';
import { useFinanzasHubPeriod } from './finanzasHubPeriod';

/**
 * Una sola barra de período, bajo el header, para todo el hub.
 * El selector (tipo + gráfico de barras) ocupa todo el ancho; el rango de
 * fechas se muestra una vez, a la derecha de la fila del selector.
 */
export default function FinanzasHubPeriodBar() {
  const hubPeriod = useFinanzasHubPeriod();
  if (!hubPeriod) return null;

  const range = getPeriodRange(hubPeriod.preset);
  const span = formatPeriodSpan(range.fechaInicio, range.fechaFin);

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        bgcolor: 'background.default',
        pt: 0.5,
        pb: 1.5,
      }}
    >
      <PeriodControl
        preset={hubPeriod.preset}
        onChange={hubPeriod.setPreset}
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
