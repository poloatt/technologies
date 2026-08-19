import React, { useState } from 'react';
import { useSnackbar } from 'notistack';
import DigitalWalletConnectButton from './DigitalWalletConnectButton';
import wiseLogo from './logos/wise.png';

export default function WiseConnectButton({ onSuccess, onError, fullWidth = false }) {
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Simular proceso de conexión
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Mostrar mensaje de próximamente
      enqueueSnackbar('Integración con Wise próximamente disponible', { variant: 'info' });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error conectando con Wise:', error);
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DigitalWalletConnectButton
      logo={wiseLogo}
      alt="Wise"
      onConnect={handleConnect}
      loading={loading}
      fullWidth={fullWidth}
    />
  );
} 
