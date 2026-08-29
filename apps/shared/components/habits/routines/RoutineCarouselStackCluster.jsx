import React from 'react';
import { Box, Tooltip } from '@mui/material';

/**
 * Cluster compacto de iconos de carrusel para hábitos apilados (stack).
 * Sin borde ni padding extra — mismos iconos que sueltos, uno al lado del otro.
 */
export default function RoutineCarouselStackCluster({ chainId, label = null, children }) {
  if (!children) return null;

  const cluster = (
    <Box
      data-habit-stack={chainId}
      aria-label={label || undefined}
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

  if (label) {
    return (
      <Tooltip title={label}>
        {cluster}
      </Tooltip>
    );
  }

  return cluster;
}
