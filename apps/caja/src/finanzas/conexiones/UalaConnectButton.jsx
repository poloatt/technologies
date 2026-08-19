import React, { useState } from 'react';
import { useSnackbar } from 'notistack';
import DigitalWalletConnectButton from './DigitalWalletConnectButton';
import ualaLogo from './logos/uala.png';

export default function UalaConnectButton({ onSuccess, onError, fullWidth = false }) {
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Simular proceso de conexión
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Mostrar mensaje de próximamente
      enqueueSnackbar('Integración con Ualá próximamente disponible', { variant: 'info' });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error conectando con Ualá:', error);
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DigitalWalletConnectButton
      logo={ualaLogo}
      alt="Ualá"
      onConnect={handleConnect}
      loading={loading}
      fullWidth={fullWidth}
    />
  );
} 
