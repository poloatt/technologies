import React from 'react';
import { Typography } from '@mui/material';
import { getEstadoColor, getEstadoText } from '@shared/components/common/StatusSystem';
import { normalizePropiedadEstado } from './propiedadConstants';

export default function PropiedadEstadoChip({ estado }) {
  const normalized = normalizePropiedadEstado(estado);
  const color = getEstadoColor(normalized, 'PROPIEDAD');

  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.25,
        borderRadius: '16px',
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.35,
        bgcolor: `${color}22`,
        color,
      }}
    >
      {getEstadoText(normalized, 'PROPIEDAD')}
    </Typography>
  );
}
