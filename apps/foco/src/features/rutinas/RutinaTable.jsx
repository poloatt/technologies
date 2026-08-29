import React, { memo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import RutinaCadenceFlatLayout from './views/cadence/RutinaCadenceFlatLayout';
import { rutinaPageLoaderSx } from '@shared/styles/rutinaPageStyles';
import { toISODateString, parseAPIDate } from '@shared/utils/dateUtils';

export const RutinaTable = ({
  rutina,
  loading: loadingProp,
}) => {
  const rutinaDateKey = (() => {
    try {
      return rutina?.fecha ? toISODateString(parseAPIDate(rutina.fecha)) : 'no-rutina';
    } catch {
      return rutina?._id || 'no-rutina';
    }
  })();

  if (loadingProp) {
    return (
      <Box sx={{ ...rutinaPageLoaderSx, height: '70vh', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!rutina || !rutina._id) {
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
      <RutinaCadenceFlatLayout rutina={rutina} />
    </Box>
  );
};

const MemoizedRutinaTable = memo(RutinaTable, (prevProps, nextProps) => {
  const prevConfig = JSON.stringify(prevProps.rutina?.config || {});
  const nextConfig = JSON.stringify(nextProps.rutina?.config || {});
  if (prevConfig !== nextConfig) return false;

  return (
    prevProps.loading === nextProps.loading
    && prevProps.rutina?._id === nextProps.rutina?._id
    && prevProps.rutina?.fecha === nextProps.rutina?.fecha
  );
});

export default MemoizedRutinaTable;
