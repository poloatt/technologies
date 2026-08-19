import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Alert,
  Checkbox
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  AttachMoney
} from '@mui/icons-material';
import { 
  StyledTableContainer, 
  StyledCuotasTextField, 
  StyledCuotasChip, 
  StyledCuotasIconButton,
  StyledCuotasCheckbox,
  FormSection
} from '@shared/components/common/CommonFormStyles';
import { useResponsive } from '@shared/hooks';
import { calcularAlquilerMensualPromedio, calcularEstadoCuota, generarCuotasMensuales } from '@shared/utils/contratoUtils';
import { useCuotasContext } from '@shared/context/CuotasContext';
import CuotaInlineEditor from './CuotaInlineEditor';

const ContratoCuotasSection = ({
  formData,
  onCuotasChange,
  showTitle = true,
  compact = false,
  sx = {}
}) => {
  const { theme } = useResponsive();
  const { cuotas, updateAllCuotas, updateCuota, updateCuotaMonto, updateCuotaEstado, syncCuotas, refrescarCuotasDesdeBackend, isLoading } = useCuotasContext();
  const [totalCalculado, setTotalCalculado] = useState(0);
  const [diferencia, setDiferencia] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingEstadoIndex, setEditingEstadoIndex] = useState(null);
  const [editingEstadoValue, setEditingEstadoValue] = useState('');

  // Calcular total y diferencia cuando cambian las cuotas
  useEffect(() => {
    const total = cuotas.reduce((sum, cuota) => sum + (cuota.monto || 0), 0);
    setTotalCalculado(total);
    
    const precioTotal = parseFloat(formData.precioTotal) || 0;
    setDiferencia(precioTotal - total);
  }, [cuotas, formData.precioTotal]);

  // Notificar cambios en las cuotas al componente padre (optimizado para evitar loops)
  useEffect(() => {
    if (onCuotasChange && cuotas.length > 0) {
      // Usar setTimeout para evitar llamadas síncronas que puedan causar loops
      const timeoutId = setTimeout(() => {
        onCuotasChange(cuotas);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [cuotas, onCuotasChange]);

  // Función para regenerar cuotas
  const regenerarCuotas = () => {
    if (formData.fechaInicio && formData.fechaFin && formData.precioTotal) {
      const cuotasGeneradas = generarCuotasMensuales({
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        precioTotal: parseFloat(formData.precioTotal) || 0,
        esMantenimiento: false
      });
      
      updateAllCuotas(cuotasGeneradas);
      if (onCuotasChange) {
        onCuotasChange(cuotasGeneradas);
      }
    }
  };

  const handleEditStart = (index, value) => {
    setEditingIndex(index);
    setEditingValue(value.toString());
  };

  const handleEditSave = () => {
    if (editingIndex !== null) {
      updateCuotaMonto(editingIndex, editingValue);
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleEstadoEditStart = (index, value) => {
    setEditingEstadoIndex(index);
    setEditingEstadoValue(value);
  };

  const handleEstadoEditSave = () => {
    if (editingEstadoIndex !== null) {
      updateCuotaEstado(editingEstadoIndex, editingEstadoValue);
      setEditingEstadoIndex(null);
      setEditingEstadoValue('');
    }
  };

  const handleEstadoEditCancel = () => {
    setEditingEstadoIndex(null);
    setEditingEstadoValue('');
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'PAGADO': return '#4caf50';
      case 'VENCIDO': return '#f44336';
      default: return '#ff9800';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'PAGADO': return 'Pagado';
      case 'VENCIDO': return 'Vencido';
      default: return 'Pendiente';
    }
  };

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      month: 'short',
      year: 'numeric'
    });
  };

  const alquilerMensualPromedio = calcularAlquilerMensualPromedio({
    fechaInicio: formData.fechaInicio,
    fechaFin: formData.fechaFin,
    precioTotal: parseFloat(formData.precioTotal) || 0,
    esMantenimiento: false
  });

  if (formData.esMantenimiento) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoney sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 500 }}>
            Cuotas Mensuales
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Promedio: ${alquilerMensualPromedio.toLocaleString()}
          </Typography>
          <Tooltip title="Refrescar cuotas desde backend">
            <StyledCuotasIconButton
              size="small"
              onClick={refrescarCuotasDesdeBackend}
              disabled={isLoading}
            >
              <RefreshIcon sx={{ fontSize: '1rem' }} />
            </StyledCuotasIconButton>
          </Tooltip>
          <Tooltip title="Regenerar cuotas automáticamente">
            <StyledCuotasIconButton
              size="small"
              onClick={regenerarCuotas}
            >
              <RefreshIcon sx={{ fontSize: '1rem', transform: 'rotate(-90deg)' }} />
            </StyledCuotasIconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Resumen de totales */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        mb: 2,
        p: 1.5,
        bgcolor: 'background.paper',
        border: t => `1px solid ${t.palette.divider}`
      }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Precio Total Contrato
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ${(parseFloat(formData.precioTotal) || 0).toLocaleString()}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Total Cuotas
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ${totalCalculado.toLocaleString()}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Diferencia
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              color: Math.abs(diferencia) < 0.01 ? 'success.main' : 'error.main'
            }}
          >
            ${diferencia.toFixed(2)}
          </Typography>
        </Box>
      </Box>

      {/* Alerta si hay diferencia significativa */}
      {Math.abs(diferencia) > 0.01 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2, borderRadius: 0 }}
        >
          La suma de las cuotas ({totalCalculado.toLocaleString()}) no coincide con el precio total del contrato ({parseFloat(formData.precioTotal || 0).toLocaleString()}). 
          Diferencia: ${diferencia.toFixed(2)}
        </Alert>
      )}

      {/* Tabla de cuotas */}
      {cuotas.length > 0 ? (
        <StyledTableContainer component={Paper} sx={{ borderRadius: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 120 }}>Mes/Año</TableCell>
                <TableCell sx={{ minWidth: 90 }}>Vencimiento</TableCell>
                <TableCell align="right" sx={{ minWidth: 90, textAlign: 'right' }}>Monto</TableCell>
                <TableCell sx={{ minWidth: 90 }}>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cuotas.map((cuota, index) => (
                <TableRow key={`${cuota.mes}-${cuota.año}`}> 
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {new Date(cuota.año, cuota.mes - 1).toLocaleDateString('es-ES', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {formatFecha(cuota.fechaVencimiento)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <CuotaInlineEditor
                      cuota={cuota}
                      onChange={nuevoCuota => updateCuotaMonto(index, nuevoCuota.monto)}
                      editable={true}
                      formData={formData}
                      tipo="monto"
                    />
                  </TableCell>
                  <TableCell>
                    <CuotaInlineEditor
                      cuota={cuota}
                      onChange={nuevoCuota => updateCuotaEstado(index, nuevoCuota.estado)}
                      editable={true}
                      formData={formData}
                      tipo="estado"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      ) : (
        <Box sx={{ 
          p: 3, 
          textAlign: 'center',
          bgcolor: 'background.paper',
          border: t => `1px solid ${t.palette.divider}`
        }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No hay cuotas generadas. Complete las fechas y precio total para generar las cuotas automáticamente.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ContratoCuotasSection; 
