import React from 'react';
import { Box, Typography, Checkbox, InputBase } from '@mui/material';
import { StyledCuotasChip } from '@shared/components/common/CommonFormStyles';
import { calcularEstadoCuota } from '@shared/utils/contratoUtils';

const CuotaInlineEditor = ({
  cuota,
  onChange,
  editable = false,
  formData = {},
  sx = {},
  tipo = 'completo', // 'monto' | 'estado' | 'completo'
}) => {
  // Handler para monto
  const handleMontoChange = (e) => {
    e.stopPropagation();
    const nuevoMonto = parseFloat(e.target.value) || 0;
    onChange({ ...cuota, monto: nuevoMonto });
  };

  // Handler para estado
  const handleEstadoChange = (e) => {
    e.stopPropagation();
    const nuevoEstado = e.target.checked ? 'PAGADO' : 'PENDIENTE';
    onChange({ ...cuota, estado: nuevoEstado });
  };

  // Estado visual
  const estadoVisual = cuota.estado === 'PAGADO'
    ? 'Pagado'
    : calcularEstadoCuota(cuota, formData) === 'VENCIDA'
      ? 'Vencida'
      : 'Pendiente';
  const colorVisual = cuota.estado === 'PAGADO'
    ? '#4caf50'
    : calcularEstadoCuota(cuota, formData) === 'VENCIDA'
      ? '#f44336'
      : '#ff9800';

  if (tipo === 'monto') {
    return (
      <InputBase
        value={cuota.monto}
        onChange={handleMontoChange}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
        type="number"
        disabled={!editable}
        inputProps={{ min: 0, step: 0.01, style: { width: 70, textAlign: 'right' } }}
        sx={{ fontSize: '0.85rem', borderRadius: 0, border: editable ? '1px solid #444' : 'none', bgcolor: editable ? '#333' : 'transparent', color: 'white', px: 1, height: 28, ...sx }}
      />
    );
  }

  if (tipo === 'estado') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
        {editable && (
          <Checkbox
            checked={cuota.estado === 'PAGADO'}
            onChange={handleEstadoChange}
            onClick={(e) => e.stopPropagation()}
            color="success"
            sx={{ p: 0.5 }}
          />
        )}
        <StyledCuotasChip
          label={estadoVisual}
          size="small"
          customcolor={colorVisual}
          sx={{ ml: 1, bgcolor: 'transparent', color: colorVisual, border: 'none', boxShadow: 'none' }}
        />
      </Box>
    );
  }

  // Por defecto, renderizado completo (no usado en la tabla)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
      <Checkbox
        checked={cuota.estado === 'PAGADO'}
        onChange={handleEstadoChange}
        onClick={(e) => e.stopPropagation()}
        color="success"
        disabled={!editable}
        sx={{ p: 0.5 }}
      />
      <InputBase
        value={cuota.monto}
        onChange={handleMontoChange}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
        type="number"
        disabled={!editable}
        inputProps={{ min: 0, step: 0.01, style: { width: 70, textAlign: 'right' } }}
        sx={{ fontSize: '0.85rem', borderRadius: 0, border: editable ? '1px solid #444' : 'none', bgcolor: editable ? '#333' : 'transparent', color: 'white', px: 1, height: 28 }}
      />
      <StyledCuotasChip
        label={estadoVisual}
        size="small"
        customcolor={colorVisual}
        sx={{ ml: 1, bgcolor: 'transparent', color: colorVisual, border: 'none', boxShadow: 'none' }}
      />
    </Box>
  );
};

export default CuotaInlineEditor; 
