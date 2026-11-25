import { Box, Typography } from '@mui/material';
import { hubEyebrowSx } from '../../hub';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { formatPeriodSpan, getPeriodRange } from '../transacciones/transaccionesPeriodUtils';
import { useFinanzasHubPeriod } from './finanzasHubPeriod';

/**
 * Una sola barra de período, bajo el header, para todo el hub.
 * El rango de fechas se muestra acá una vez: a la derecha del selector en
 * misma fila, a la derecha del selector (centrado en pantallas anchas).
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
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
        alignItems: 'start',
        columnGap: 2.5,
      }}
    >
      <Box sx={{ gridColumn: { xs: 1, sm: 2 }, gridRow: 1, minWidth: 0 }}>
        <PeriodControl preset={hubPeriod.preset} onChange={hubPeriod.setPreset} />
      </Box>
      {span && (
        <Typography
          variant="caption"
          aria-label="Rango del período"
          sx={{
            ...hubEyebrowSx,
            mb: 0,
            gridColumn: { xs: 2, sm: 3 },
            gridRow: 1,
            justifySelf: 'end',
            lineHeight: '28px',
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}
        >
          {span}
        </Typography>
      )}
    </Box>
  );
}
