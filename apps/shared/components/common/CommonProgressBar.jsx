import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';

const ProgressBar = ({
  // Datos de progreso
  value = 0,
  maxValue = 100,
  percentage = null,
  
  // Etiquetas
  leftLabel = null,
  rightLabel = null,
  showLabels = true,
  
  // Configuración visual
  variant = 'default', // 'default', 'compact', 'large'
  color = 'primary', // 'primary', 'success', 'warning', 'error'
  height = null,
  
  // Configuración de datos
  dataType = 'percentage', // 'percentage', 'days', 'amount', 'custom'
  
  // Datos específicos para propiedades
  diasTranscurridos = null,
  diasTotales = null,
  simboloMoneda = '$',
  montoMensual = null,
  montoTotal = null,
  estado = null,
  
  // Datos específicos para cuotas
  cuotasPagadas = null,
  cuotasTotales = null,
  montoPagado = null,
  montoTotalCuotas = null,
  
  // Estilos personalizados
  sx = {},

  // Barra en movimiento mientras no hay un valor cerrado
  indeterminate = false,
  
  // Contexto específico
  isAssets = false
}) => {
  // Calcular el valor de progreso
  const getProgressValue = () => {
    if (percentage !== null) return Math.min(100, Math.max(0, percentage));
    if (value !== null && maxValue !== null) return Math.min(100, Math.max(0, (value / maxValue) * 100));
    return 0;
  };

  // Generar etiquetas según el tipo de datos
  const getLabels = () => {
    if (!showLabels) return { left: null, right: null };

    switch (dataType) {
      case 'days':
        return {
          left: diasTranscurridos !== null && diasTotales !== null 
            ? `${diasTranscurridos}/${diasTotales} días`
            : leftLabel,
          right: rightLabel // Mostrar rightLabel si está presente
        };
      
      case 'cuotas':
        return {
          left: cuotasPagadas !== null && cuotasTotales !== null && cuotasPagadas > 0
            ? `${cuotasPagadas}/${cuotasTotales} cuotas`
            : leftLabel,
          right: montoPagado !== null && montoTotalCuotas !== null && montoPagado > 0
            ? `${simboloMoneda} ${montoPagado.toLocaleString()}/${montoTotalCuotas.toLocaleString()}`
            : rightLabel
        };
      
      case 'amount':
        return {
          left: leftLabel || `${simboloMoneda} ${value?.toLocaleString() || 0}`,
          right: rightLabel || `${simboloMoneda} ${maxValue?.toLocaleString() || 0}`
        };
      
      default:
        return {
          left: leftLabel || `${Math.round(getProgressValue())}%`,
          right: rightLabel
        };
    }
  };

  const progressValue = getProgressValue();
  const labels = getLabels();
  const finalHeight = height || (variant === 'compact' ? 2.5 : variant === 'large' ? 6 : 3);
  
  // Función para obtener el color basado en el tipo
  const getColorValue = (colorType) => {
    switch (colorType) {
      case 'success': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'error': return '#f44336';
      case 'primary':
      default: return '#ffffff';
    }
  };

  return (
    <Box sx={{ ...sx }}>
      {showLabels && (labels.left || labels.right) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: variant === 'compact' ? 0.25 : 0.5 }}>
          {labels.left && (
            <Typography variant="caption" sx={{ 
              fontSize: variant === 'compact' ? '0.6rem' : '0.65rem', 
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: variant === 'compact' ? 1.1 : 1.2
            }}>
              {labels.left}
            </Typography>
          )}
          {labels.right && (
            <Typography variant="caption" sx={{ 
              fontSize: variant === 'compact' ? '0.6rem' : '0.65rem', 
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: variant === 'compact' ? 1.1 : 1.2
            }}>
              {labels.right}
            </Typography>
          )}
        </Box>
      )}
      <LinearProgress
        variant={indeterminate ? 'indeterminate' : 'determinate'}
        value={indeterminate ? undefined : progressValue}
        sx={{ 
          height: finalHeight,
          borderRadius: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 0,
            backgroundColor: getColorValue(color)
          }
        }}
      />
    </Box>
  );
};

export default ProgressBar; 
