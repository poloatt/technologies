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

const MemoizedRutinaDayView = memo(RutinaDayView, (prevProps, nextProps) => {
  if (prevProps.readOnly !== nextProps.readOnly) return false;
  if (prevProps.isPreview !== nextProps.isPreview) return false;
  if (prevProps.rutina?._id !== nextProps.rutina?._id) return false;
  if (prevProps.rutina?.fecha !== nextProps.rutina?.fecha) return false;
  if (Boolean(prevProps.rutina?.isPreview) !== Boolean(nextProps.rutina?.isPreview)) return false;

  const prevConfig = JSON.stringify(prevProps.rutina?.config || {});
  const nextConfig = JSON.stringify(nextProps.rutina?.config || {});
  if (prevConfig !== nextConfig) return false;

  // Completados por sección (sin esto, multi-marcar en histórico no re-renderiza).
  const prevCompletion = JSON.stringify(prevProps.rutina, (key, value) => {
    if (key === 'config' || key === 'historial' || key === 'completitud') return undefined;
    return value;
  });
  const nextCompletion = JSON.stringify(nextProps.rutina, (key, value) => {
    if (key === 'config' || key === 'historial' || key === 'completitud') return undefined;
    return value;
  });

  return prevCompletion === nextCompletion;
});

export default MemoizedRutinaDayView;
