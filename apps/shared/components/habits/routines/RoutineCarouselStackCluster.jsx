import React from 'react';
import { Box } from '@mui/material';

/**
 * Cluster compacto de iconos de carrusel para hábitos apilados (stack).
 * Sin borde ni padding extra — mismos iconos que sueltos, uno al lado del otro.
 */
export default function RoutineCarouselStackCluster({ chainId, children }) {
  if (!children) return null;

  return (
    <Box
      data-habit-stack={chainId}
      sx={{
        display: 'inline-flex',
        flex: '0 0 auto',
        flexShrink: 0,
        alignItems: 'center',
        gap: 0.25,
      }}
    >
      {children}
    </Box>
  );
}
