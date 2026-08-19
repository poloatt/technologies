import React from 'react';
import { Box, Chip, Typography, Tooltip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import { useMercadoPago } from '../../hooks/useMercadoPago';

export default function MercadoPagoStatusIndicator({ connectionId, onStatusChange }) {
  const { connectionStatus, getConnectionStatus } = useMercadoPago();

  React.useEffect(() => {
    // Actualizar el estado de conexión al montar el componente
    const status = getConnectionStatus();
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [getConnectionStatus, onStatusChange]);

  const getStatusConfig = (status) => {
    const configs = {
      connected: {
        color: 'success',
        icon: <CheckCircleIcon />,
        label: 'Conectado',
        tooltip: 'Conexión activa con MercadoPago'
      },
      connecting: {
        color: 'info',
        icon: <SyncIcon />,
        label: 'Conectando...',
        tooltip: 'Estableciendo conexión con MercadoPago'
      },
      disconnected: {
        color: 'default',
        icon: <PendingIcon />,
        label: 'Desconectado',
        tooltip: 'No hay conexión activa con MercadoPago'
      },
      error: {
        color: 'error',
        icon: <ErrorIcon />,
        label: 'Error',
        tooltip: 'Error en la conexión con MercadoPago'
      }
    };
    
    return configs[status] || configs.disconnected;
  };

  const statusConfig = getStatusConfig(connectionStatus);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={statusConfig.tooltip} arrow>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: 0,
            borderWidth: 2,
            fontWeight: 500,
            '& .MuiChip-icon': {
              fontSize: 16
            }
          }}
        />
      </Tooltip>
      
      {connectionId && (
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          ID: {connectionId.slice(-8)}
        </Typography>
      )}
    </Box>
  );
} 