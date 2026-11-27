import React from 'react';
import { Typography } from '@mui/material';
import { getEstadoColor, getEstadoText } from '@shared/components/common/StatusSystem';
import { FONT_SIZE } from '@shared/tipografia';

export default function InquilinoEstadoChip({ estado = 'PENDIENTE' }) {
  const color = getEstadoColor(estado, 'INQUILINO');

  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.25,
        borderRadius: '16px',
        fontSize: FONT_SIZE.sm,
        fontWeight: 500,
        lineHeight: 1.35,
        bgcolor: `${color}22`,
        color,
      }}
    >
      {getEstadoText(estado, 'INQUILINO')}
    </Typography>
  );
}
