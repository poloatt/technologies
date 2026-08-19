import React, { useState } from 'react';
import { Button, CircularProgress, Alert, Box } from '@mui/material';
import { FORM_HEIGHTS } from '@shared/config/uiConstants';
import { useMercadoPago } from '@shared/hooks/useMercadoPago';
import { isMercadoPagoEnabled, getRedirectURI } from '@shared/config/mercadopago';

// Intentar importar el logo de diferentes maneras
let mercadopagoLogo;
try {
  mercadopagoLogo = new URL('./logos/mercadopago.svg', import.meta.url).href;
  console.log('✅ [MercadoPago] Logo URL cargado:', mercadopagoLogo);
} catch (e) {
  console.warn('⚠️ [MercadoPago] No se pudo cargar logo SVG:', e);
  mercadopagoLogo = '';
}

export default function MercadoPagoConnectButton({ onSuccess, onError, fullWidth = false }) {
  const { connecting, connect } = useMercadoPago();
  const [localError, setLocalError] = useState(null);

  const handleConnect = async () => {
    console.log('🔵 [MercadoPago] Iniciando conexión...');
    console.log('🔵 [MercadoPago] Enabled:', isMercadoPagoEnabled());
    console.log('🔵 [MercadoPago] Redirect URI:', getRedirectURI());
    
    setLocalError(null);
    
    try {
      await connect();
      console.log('✅ [MercadoPago] Conexión iniciada exitosamente');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('❌ [MercadoPago] Error al conectar:', error);
      setLocalError(error.message || 'Error al conectar con MercadoPago');
      // NO llamamos onError para mantener el modal abierto
    }
  };

  if (!isMercadoPagoEnabled()) {
    console.warn('⚠️ [MercadoPago] Función deshabilitada');
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2, 
        width: '100%',
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'warning.main'
      }}>
        <Alert severity="warning">
          MercadoPago está deshabilitado en desarrollo.
        </Alert>
        <Box sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
          Para habilitar:
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Agrega <code>?mpdev=1</code> a la URL</li>
            <li>O ejecuta en consola: <code>localStorage.setItem('MP_DEV', '1')</code></li>
          </ul>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      {localError && (
        <Alert severity="error" onClose={() => setLocalError(null)}>
          {localError}
        </Alert>
      )}
      <Button
        onClick={handleConnect}
        disabled={connecting}
        sx={{
          minWidth: 0,
          minHeight: 48,
          width: fullWidth ? '100%' : 'auto',
          bgcolor: 'transparent',
          borderRadius: 0,
          boxShadow: 'none',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          '&:hover': { bgcolor: 'grey.900' },
          '&:disabled': { opacity: 0.6 }
        }}
        fullWidth={fullWidth}
      >
        {connecting ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          mercadopagoLogo ? (
            <img 
              src={mercadopagoLogo} 
              alt="MercadoPago" 
              style={{ 
                maxWidth: 120, 
                width: '100%', 
                height: FORM_HEIGHTS.input, 
                objectFit: 'contain' 
              }} 
            />
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 1,
              color: 'text.primary',
              fontWeight: 600,
              px: 2
            }}>
              Conectar MercadoPago
            </Box>
          )
        )}
      </Button>
    </Box>
  );
} 