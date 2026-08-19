import React from 'react';
import { Fab, Tooltip } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

/**
 * Botón flotante principal para crear una nueva transacción económica.
 * UX: prominente, intuitivo, accesible y con feedback visual.
 */
export default function FabNuevaTransaccion({ onClick }) {
  return (
    <Tooltip title="Registrar nuevo pago o ingreso" arrow placement="left">
      <Fab
        aria-label="Nueva transacción económica"
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: { xs: 80, sm: 96 },
          right: { xs: 16, sm: 32 },
          zIndex: 2000,
          width: 64,
          height: 64,
          borderRadius: '50%',
          boxShadow: '0 4px 16px rgba(40,40,40,0.18)',
          bgcolor: 'background.paper',
          color: '#fff',
          minHeight: 0,
          minWidth: 0,
          border: 'none',
          transition: 'box-shadow 0.18s, transform 0.18s',
          '&:hover': {
            bgcolor: 'background.paper',
            boxShadow: '0 8px 24px 2px rgba(40,40,40,0.28)',
            transform: 'scale(1.08)',
          },
        }}
      >
        <AddCircleOutlineIcon sx={{ fontSize: 38, color: '#fff' }} />
      </Fab>
    </Tooltip>
  );
} 
