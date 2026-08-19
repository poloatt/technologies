import React from 'react';
import { Button } from '@mui/material';
import { AddOutlined } from '@mui/icons-material';

/** CTA compacto para crear contrato desde listas / hub. */
export default function AgregarContratoButton({ onClick, size = 'small', sx = {}, ...rest }) {
  return (
    <Button
      size={size}
      startIcon={<AddOutlined sx={{ fontSize: size === 'small' ? 16 : 18 }} />}
      onClick={onClick}
      sx={{
        minWidth: 0,
        px: 1,
        py: 0.25,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.2,
        textTransform: 'none',
        color: 'primary.main',
        flexShrink: 0,
        ...sx,
      }}
      {...rest}
    >
      Agregar contrato
    </Button>
  );
}
