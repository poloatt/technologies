import React from 'react';
import { Box, Typography } from '@mui/material';
import { getHubChipSx, hubLabelSx, hubMetricsRowSx, hubValueSx } from '../styles/attaHubChipStyles';

export function MetricChip({ label, value, color, sx }) {
  return (
    <Box sx={{ ...getHubChipSx(), flex: 1, ...sx }}>
      <Typography variant="caption" noWrap sx={hubLabelSx}>
        {label}
      </Typography>
      <Typography variant="caption" noWrap sx={{ ...hubValueSx, color }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Fila de métricas (ingresos / gastos / balance, etc.). */
export default function HubMetricsRow({ children, sx }) {
  return <Box sx={{ ...hubMetricsRowSx, ...sx }}>{children}</Box>;
}

export { hubMetricsRowSx };
