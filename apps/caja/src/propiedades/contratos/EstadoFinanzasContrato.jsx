import React, { useState, useEffect, useMemo } from 'react';
import { SECTION_PADDING_X } from '../';
import {
  Box,
  Typography,
  Collapse,
  IconButton
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import CommonProgressBar from '@shared/components/common/CommonProgressBar';
import {
  MonetizationOnOutlined as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Payment as PaymentIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { StyledCuotasIconButton } from '@shared/components/common/CommonFormStyles';
import CuotaInlineEditor from './CuotaInlineEditor';
import { useCuotasContext } from '@shared/context/CuotasContext';
import { calcularEstadoCuotasContrato, formatMontoAbreviado } from '@shared/utils/contratoUtils';
import { getEstadoColor } from '@shared/components/common/StatusSystem';

// Subcomponente: Muestra mensaje cuando no hay cuotas configuradas
const CuotasSinConfigurar = ({ contrato, compact, noBorder, sx, estadoContrato }) => {
  // Si es contrato de mantenimiento, mostrar mensaje especial
  if (contrato?.esMantenimiento) {
    return (
      <Box sx={{
        mt: 0.5,
        bgcolor: 'transparent',
        borderRadius: 0,
        border: 'none',
        width: '100%',
        boxSizing: 'border-box',
        ...sx
      }}>
        <Typography variant="caption" sx={{
          fontSize: compact ? '0.6rem' : '0.65rem',
          color: getEstadoColor('MANTENIMIENTO', 'CONTRATO'),
          fontWeight: 600,
          fontStyle: 'italic',
          bgcolor: 'transparent',
          px: 0,
          py: 0.5
        }}>
          Contrato de mantenimiento
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: compact ? '0.55rem' : '0.6rem', color: 'text.secondary' }}>
            Monto total: {contrato?.cuenta?.moneda?.simbolo || contrato?.moneda?.simbolo || '$'} {formatMontoAbreviado(contrato.precioTotal || 0)}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: compact ? '0.55rem' : '0.6rem', color: 'text.secondary' }}>
            {contrato.fechaInicio && contrato.fechaFin ?
              `${new Date(contrato.fechaInicio).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric'
              })} - ${new Date(contrato.fechaFin).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}` :
              'Fechas no especificadas'
            }
          </Typography>
        </Box>
      </Box>
    );
  }
  let mensaje = 'Sin cuotas mensuales configuradas';
  let color = 'text.secondary';
  if (estadoContrato === 'PLANEADO') {
    mensaje = 'Contrato planeado - Inicia en el futuro';
    color = 'warning.main';
  } else if (estadoContrato === 'FINALIZADO') {
    mensaje = 'Contrato finalizado';
    color = 'text.disabled';
  } else if (estadoContrato === 'ACTIVO') {
    mensaje = 'Sin cuotas mensuales configuradas';
    color = 'error.main';
  }
  return (
    <Box sx={{
      mt: 0.5,
      bgcolor: noBorder ? 'transparent' : (compact ? '#181818' : 'background.paper'),
      borderRadius: 0,
      border: noBorder ? 'none' : '1px solid rgba(255,255,255,0.08)',
      width: '100%',
      boxSizing: 'border-box',
      ...sx
    }}>
      <Typography variant="caption" sx={{
        fontSize: compact ? '0.6rem' : '0.65rem',
        color: color,
        fontStyle: 'italic'
      }}>
        {mensaje}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: compact ? '0.55rem' : '0.6rem', color: 'text.secondary' }}>
          Monto total: {contrato?.cuenta?.moneda?.simbolo || contrato?.moneda?.simbolo || '$'} {formatMontoAbreviado(contrato.precioTotal || 0)}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: compact ? '0.55rem' : '0.6rem', color: 'text.secondary' }}>
          {contrato.fechaInicio && contrato.fechaFin ?
            `${new Date(contrato.fechaInicio).toLocaleDateString('es-ES', {
              day: '2-digit', month: 'short', year: 'numeric'
            })} - ${new Date(contrato.fechaFin).toLocaleDateString('es-ES', {
              day: '2-digit', month: 'short', year: 'numeric'
            })}` :
            'Fechas no especificadas'
          }
        </Typography>
      </Box>
    </Box>
  );
};

// Subcomponente: Resumen de cuotas (no compacto)
const ResumenCuotas = ({ cuotasPagadas, cuotasTotales, montoPagado, montoTotal, simboloMoneda, porcentajePagado, compact }) => (
  <>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, px: SECTION_PADDING_X }}>
      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
        {cuotasPagadas}/{cuotasTotales} días
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
        {simboloMoneda} {formatMontoAbreviado(montoPagado)}/{formatMontoAbreviado(montoTotal)}
      </Typography>
    </Box>
    <Box sx={{ px: SECTION_PADDING_X, mb: 0.5 }}>
      <CommonProgressBar
        dataType="cuotas"
        cuotasPagadas={cuotasPagadas}
        cuotasTotales={cuotasTotales}
        montoPagado={montoPagado}
        montoTotalCuotas={montoTotal}
        percentage={porcentajePagado}
        color="primary"
        variant="default"
        showLabels={false}
        sx={{ mb: 0 }}
      />
    </Box>
  </>
);

const EstadoFinanzasContrato = ({ 
  contrato, // Recibo el contrato completo, no un estado calculado
  contratoId,
  showTitle = true, 
  compact = false,
  sx = {},
  noBorder = false // Nuevo prop para controlar el borde
}) => {
  const [showCuotas, setShowCuotas] = useState(false);
  const [editInline, setEditInline] = useState(false);

  // Usar el contexto de cuotas para estado reactivo
  const { 
    cuotas, 
    updateCuota, 
    guardarCuotasEnBackend, 
    isLoading,
    syncCuotas,
    refrescarCuotasDesdeBackend,
    setCuotas
  } = useCuotasContext();

  // Calcular estado de cuotas dinámicamente desde el contexto y el contrato
  const estadoCuotasCalculado = useMemo(() => {
    if (!contrato || cuotas.length === 0) {
      return {
        cuotasPagadas: 0,
        cuotasTotales: 0,
        montoPagado: 0,
        montoTotal: 0,
        porcentajePagado: 0,
        proximaCuota: null,
        cuotasVencidas: 0,
        cuotasMensuales: []
      };
    }
    // Usar las cuotas del contexto para calcular el estado actual
    const contratoConCuotasActualizadas = {
      ...contrato,
      cuotasMensuales: cuotas
    };
    return calcularEstadoCuotasContrato(contratoConCuotasActualizadas);
  }, [cuotas, contrato]);

  // Extraer datos del estado calculado
  const { cuotasPagadas, cuotasTotales, montoPagado, montoTotal, porcentajePagado, proximaCuota, cuotasVencidas } = estadoCuotasCalculado;
  const simboloMoneda = contrato?.cuenta?.moneda?.simbolo || contrato?.moneda?.simbolo || '$';

  const { isMobile } = useResponsive();

  if (!contrato) {
    return null;
  }

  // Determinar el estado del contrato
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = contrato.fechaInicio ? new Date(contrato.fechaInicio) : null;
  const fechaFin = contrato.fechaFin ? new Date(contrato.fechaFin) : null;
  
  let estadoContrato = 'PENDIENTE';
  if (fechaInicio && fechaFin) {
    if (fechaInicio <= hoy && fechaFin > hoy) {
      estadoContrato = 'ACTIVO';
    } else if (fechaInicio > hoy) {
      estadoContrato = 'PLANEADO';
    } else if (fechaFin < hoy) {
      estadoContrato = 'FINALIZADO';
    }
  }

  // Si no hay cuotas válidas, mostrar información según el estado del contrato
  if (cuotasTotales === 0) {
    return <CuotasSinConfigurar contrato={contrato} compact={compact} noBorder={noBorder} sx={sx} estadoContrato={estadoContrato} />;
  }

  return (
    <Box sx={{ 
      mt: compact ? 0 : 0.2, 
      m: 0,
      bgcolor: noBorder ? 'transparent' : (compact ? '#181818' : 'transparent'),
      borderRadius: 0,
      border: noBorder ? 'none' : undefined,
      cursor: 'pointer',
      '&:hover': {
        bgcolor: noBorder ? 'transparent' : (compact ? '#181818' : 'transparent')
      },
      ...sx
    }}
    onClick={() => setShowCuotas((prev) => !prev)}
    >

      {/* Información de cuotas y montos - SIEMPRE ARRIBA DE LA BARRA */}
      {!compact && (
        <ResumenCuotas
          cuotasPagadas={cuotasPagadas}
          cuotasTotales={cuotasTotales}
          montoPagado={montoPagado}
          montoTotal={montoTotal}
          simboloMoneda={simboloMoneda}
          porcentajePagado={porcentajePagado}
          compact={compact}
        />
      )}
      {/* Chips de cuotas vencidas o al día */}
      {cuotasVencidas > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mt: compact ? 0 : 0.2,
            py: 0.2,
            px: SECTION_PADDING_X,
            bgcolor: 'transparent',
            borderRadius: 0,
            border: 'none',
            justifyContent: 'space-between',
            width: '100%',
            m: 0
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1 }}>
            <MoneyIcon sx={{ fontSize: '1.2rem', color: 'error.main', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ fontSize: compact ? '0.6rem' : '0.65rem', color: 'error.main', fontWeight: 600 }}>
              {cuotasVencidas} cuota{cuotasVencidas > 1 ? 's' : ''} vencida{cuotasVencidas > 1 ? 's' : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            {showCuotas && (
              <>
                <StyledCuotasIconButton size="small" sx={{ color: 'text.secondary' }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Forzar refresh y sobrescribir el estado local con el backend
                    const ok = await refrescarCuotasDesdeBackend();
                    if (ok && typeof window !== 'undefined') {
                      // Opcional: podrías mostrar una notificación de éxito aquí
                    }
                  }}
                  disabled={isLoading || editInline}
                >
                  <RefreshIcon sx={{ fontSize: '0.75rem' }} />
                </StyledCuotasIconButton>
                <StyledCuotasIconButton size="small" sx={{ color: 'text.secondary' }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (editInline) {
                      // Siempre guardar al salir del modo edición
                      const exito = await guardarCuotasEnBackend(cuotas);
                      if (exito) {
                        setEditInline(false);
                      } else {
                        alert('Error al guardar cuotas');
                      }
                    } else {
                      setEditInline(true);
                    }
                  }}
                  disabled={isLoading}
                >
                  {editInline ? <SaveIcon sx={{ fontSize: '0.75rem' }} /> : <EditIcon sx={{ fontSize: '0.75rem' }} />}
                </StyledCuotasIconButton>
              </>
            )}
            <StyledCuotasIconButton 
              size="small" 
              sx={{ color: 'error.main' }} 
              onClick={(e) => {
                e.stopPropagation();
                setShowCuotas((prev) => !prev);
              }}
            >
              {showCuotas ? <ExpandLessIcon sx={{ fontSize: '0.75rem' }} /> : <ExpandMoreIcon sx={{ fontSize: '0.75rem' }} />}
            </StyledCuotasIconButton>
          </Box>
        </Box>
      )}
      {cuotasVencidas === 0 && cuotasTotales > 0 && (
        (() => {
          const pagadas = cuotas.filter(c => c.estado === 'PAGADO').length;
          const pendientes = cuotas.filter(c => c.estado === 'PENDIENTE').length;
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: compact ? 0 : 0.2,
                py: 0.2,
                px: SECTION_PADDING_X,
                bgcolor: 'transparent',
                borderRadius: 0,
                border: 'none',
                justifyContent: 'space-between',
                width: '100%',
                m: 0
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, pl: 1 }}>
                <MoneyIcon sx={{ fontSize: '1.2rem', color: 'text.secondary', flexShrink: 0, mt: 0.1 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
                  <Typography variant="caption" sx={{ fontSize: compact ? '0.6rem' : '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
                    {pagadas} cuota{pagadas !== 1 ? 's' : ''} pagada{pagadas !== 1 ? 's' : ''}
                    {pendientes > 0 && (
                      <span style={{ color: '#888', fontWeight: 400 }}>
                        {' · '}{pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                      </span>
                    )}
                  </Typography>
                  {proximaCuota && (
                    <Typography variant="caption" sx={{ fontSize: compact ? '0.55rem' : '0.6rem', color: '#888', fontWeight: 400 }}>
                      próxima cuota {proximaCuota.index} en {proximaCuota.diasRestantes} días
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                {showCuotas && (
                  <>
                    <StyledCuotasIconButton 
                      size="small" 
                      sx={{ color: 'text.secondary' }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        refrescarCuotasDesdeBackend();
                      }} 
                      disabled={isLoading}
                    >
                      <RefreshIcon sx={{ fontSize: '0.75rem' }} />
                    </StyledCuotasIconButton>
                    <StyledCuotasIconButton 
                      size="small" 
                      sx={{ color: 'text.secondary' }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editInline) {
                          setEditInline(false);
                        } else {
                          setEditInline(true);
                        }
                      }} 
                      disabled={isLoading}
                    >
                      {editInline ? <SaveIcon sx={{ fontSize: '0.75rem' }} /> : <EditIcon sx={{ fontSize: '0.75rem' }} />}
                    </StyledCuotasIconButton>
                  </>
                )}
                <StyledCuotasIconButton 
                  size="small" 
                  sx={{ color: 'text.secondary' }} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCuotas((prev) => !prev);
                  }}
                >
                  {showCuotas ? <ExpandLessIcon sx={{ fontSize: '0.75rem' }} /> : <ExpandMoreIcon sx={{ fontSize: '0.75rem' }} />}
                </StyledCuotasIconButton>
              </Box>
            </Box>
          );
        })()
      )}
      
      {/* Lista expandible de cuotas */}
      <Collapse in={showCuotas && cuotasTotales > 0}>
        <Box 
          sx={{ mt: 1, mb: 1, bgcolor: '#222', borderRadius: 0, p: 1, width: '100%' }}
          onClick={(e) => e.stopPropagation()}
        >
          {cuotas && cuotas.length > 0 ? (
            cuotas.map((cuota, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ width: 32, color: 'text.secondary' }}>#{cuota.numero}</Typography>
                <Typography variant="caption" sx={{ width: 80, color: 'text.secondary' }}>{cuota.fechaVencimiento ? new Date(cuota.fechaVencimiento).toLocaleDateString('es-ES') : ''}</Typography>
                <CuotaInlineEditor
                  cuota={cuota}
                  onChange={nuevoCuota => {
                    if (!editInline) return;
                    // Usar el contexto para actualizar la cuota
                    updateCuota(idx, nuevoCuota);
                  }}
                  editable={editInline}
                  formData={contrato || {}}
                />
                <Box sx={{ flex: 1 }} />
              </Box>
            ))
          ) : (
            <Typography variant="caption" color="text.secondary">No hay cuotas generadas.</Typography>
          )}
          {/* Botón para guardar cambios si está en modo edición */}
          {editInline && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <StyledCuotasIconButton
                size="small"
                sx={{ color: 'text.secondary' }}
                disabled={isLoading}
                onClick={async (e) => {
                  e.stopPropagation();
                  // Usar el contexto para guardar las cuotas
                  const exito = await guardarCuotasEnBackend(cuotas);
                  if (exito) {
                    setEditInline(false);
                  } else {
                    alert('Error al guardar cuotas');
                  }
                }}
              >
                <SaveIcon sx={{ fontSize: '0.75rem' }} />
              </StyledCuotasIconButton>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default EstadoFinanzasContrato; 
