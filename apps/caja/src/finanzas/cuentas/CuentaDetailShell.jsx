import React from 'react';
import { Drawer, Box } from '@mui/material';

/**
 * Contenedor de detalle de cuenta en desktop (drawer lateral).
 * En mobile el panel se renderiza inline en Cuentas.jsx.
 */
export default function CuentaDetailShell({ open, onClose, children }) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400, md: 460 },
          maxWidth: '100vw',
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
        },
      }}
    >
      <Box sx={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Drawer>
  );
}
