import { Box } from '@mui/material';
import { PeriodControl } from '../transacciones/TransaccionesFlujoVisual';
import { useFinanzasHubPeriod } from './finanzasHubPeriod';

/** Una sola barra de período, bajo el header, para todo el hub. */
export default function FinanzasHubPeriodBar() {
  const hubPeriod = useFinanzasHubPeriod();
  if (!hubPeriod) return null;

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
      <PeriodControl preset={hubPeriod.preset} onChange={hubPeriod.setPreset} />
    </Box>
  );
}
