import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { FORM_HEIGHTS } from '@shared/config/uiConstants';

export default function DigitalWalletConnectButton({ 
  logo, 
  alt, 
  onConnect, 
  loading = false, 
  disabled = false,
  fullWidth = false,
  sx = {}
}) {
  return (
    <Button
      onClick={onConnect}
      disabled={disabled || loading}
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
        '&:disabled': { opacity: 0.6 },
        ...sx
      }}
      fullWidth={fullWidth}
    >
      {loading ? (
        <CircularProgress size={24} color="inherit" />
      ) : (
        <img 
          src={logo} 
          alt={alt} 
          style={{ 
            maxWidth: 120, 
            width: '100%', 
            height: FORM_HEIGHTS.input, 
            objectFit: 'contain' 
          }} 
        />
      )}
    </Button>
  );
} 
