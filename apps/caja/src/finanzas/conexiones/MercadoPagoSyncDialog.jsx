import React from 'react';
import { Box, Dialog, DialogContent, Typography } from '@mui/material';
import MercadoPagoConnectButton from './MercadoPagoConnectButton';

/** Modal de sync / conexión Mercado Pago (toolbar Finanzas y setup Cuentas). */
export default function MercadoPagoSyncDialog({ open, onClose, onSuccess }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
          Sincronizar cuenta
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
          Conectá Mercado Pago para importar o vincular una cuenta.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MercadoPagoConnectButton
            fullWidth
            onSuccess={() => {
              onSuccess?.();
              onClose?.();
              window.dispatchEvent(new CustomEvent('cuentasRefreshed'));
            }}
            onError={(error) => {
              console.error('Error en conexión MercadoPago:', error);
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
