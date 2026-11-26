import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import RutinaCadenceFlatLayout from './views/cadence/RutinaCadenceFlatLayout';
import { toISODateString, parseAPIDate } from '@shared/utils/dateUtils';

/** Vista del día activo: layout plano por cadencia. */
export function RutinaDayView({
  rutina,
  readOnly = false,
  isPreview = false,
}) {
  const rutinaDateKey = (() => {
    try {
      return rutina?.fecha ? toISODateString(parseAPIDate(rutina.fecha)) : 'no-rutina';
    } catch {
      return rutina?._id || rutina?.fecha || 'no-rutina';
    }
  })();

  if (!rutina || (!rutina._id && !isPreview && !rutina.isPreview)) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">
          No hay ninguna rutina para mostrar
        </Typography>
      </Box>
    );
  }

  return (
    <Box key={rutinaDateKey}>
      <RutinaCadenceFlatLayout
        rutina={rutina}
        readOnly={readOnly}
        isPreview={isPreview || Boolean(rutina.isPreview)}
      />
    </Box>
  );
}

export default memo(RutinaDayView);
