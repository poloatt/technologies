import React, { useState } from 'react';
import { useSnackbar } from 'notistack';
import DigitalWalletConnectButton from './DigitalWalletConnectButton';
import googleWalletLogo from './logos/google-wallet.png';

export default function GoogleWalletConnectButton({ onSuccess, onError, fullWidth = false }) {
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Simular proceso de conexión
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Mostrar mensaje de próximamente
      enqueueSnackbar('Integración con Google Wallet próximamente disponible', { variant: 'info' });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error conectando con Google Wallet:', error);
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DigitalWalletConnectButton
      logo={googleWalletLogo}
      alt="Google Wallet"
      onConnect={handleConnect}
      loading={loading}
      fullWidth={fullWidth}
    />
  );
} 
