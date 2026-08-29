import React from 'react';
import { Box } from '@mui/material';
import TiempoToolbarActions from './TiempoToolbarActions';

/** Acciones de contexto centradas en la toolbar de Rutinas (undo, setup, +). */
export default function RutinasToolbarCenter() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <TiempoToolbarActions section="rutinas" dense />
    </Box>
  );
}
