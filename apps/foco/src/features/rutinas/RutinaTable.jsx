import React, { memo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import RutinaCadenceFlatLayout from './views/cadence/RutinaCadenceFlatLayout';
import { rutinaPageLoaderSx } from '@shared/styles/rutinaPageStyles';
import { toISODateString, parseAPIDate } from '@shared/utils/dateUtils';

export const RutinaTable = ({
  rutina,
  loading: loadingProp,
  readOnly = false,
  isPreview = false,
}) => {
  const rutinaDateKey = (() => {
    try {
      return rutina?.fecha ? toISODateString(parseAPIDate(rutina.fecha)) : 'no-rutina';
    } catch {
      return rutina?._id || rutina?.fecha || 'no-rutina';
    }
  })();

  if (loadingProp) {
    return (
      <Box sx={{ ...rutinaPageLoaderSx, height: '70vh', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

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
};

const MemoizedRutinaTable = memo(RutinaTable, (prevProps, nextProps) => {
  if (prevProps.loading !== nextProps.loading) return false;
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

export default MemoizedRutinaTable;
