import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  LinearProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useResponsive } from '@shared/hooks';
import {
  Close as CloseIcon,
  Description,
  Engineering
} from '@mui/icons-material';
import { ContratoPropiedadSection, ContratoHabitacionSection, ContratoInquilinosSection, ContratoMontosSection } from './ContratosSection';
import ContratoCuotasSection from './ContratoCuotasSection';
import { CircularProgress } from '@mui/material';
import { CuotasProvider } from '@shared/context/CuotasContext';
import { CommonDate } from '@shared/components/common/CommonDate';
import { getDocumentId } from '../habitacionConstants';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 0,
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.down('sm')]: {
      margin: 0,
      maxHeight: '100%',
      height: '100%',
      width: '100%',
      maxWidth: '100%'
    },
    [theme.breakpoints.up('sm')]: {
      minWidth: '500px',
      maxWidth: '700px'
    }
  }
}));

const FormSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1)
}));

const ContratoForm = ({
  open = false,
  initialData = {},
  relatedData = {},
  onSubmit,
  onClose,
  isSaving = false
}) => {
  const { theme, isMobile } = useResponsive();
  
  const safeInitialData = initialData || {};
  
  const [formData, setFormData] = useState({
    inquilino: safeInitialData.inquilino || [],
    propiedad: safeInitialData.propiedad?._id || safeInitialData.propiedad || '',
    esPorHabitacion: safeInitialData.esPorHabitacion || false,
    habitacion: safeInitialData.habitacion?._id || safeInitialData.habitacion || '',
    fechaInicio: safeInitialData.fechaInicio ? new Date(safeInitialData.fechaInicio) : null,
    fechaFin: safeInitialData.fechaFin ? new Date(safeInitialData.fechaFin) : null,
    precioTotal: safeInitialData.precioTotal?.toString() || '0',
    cuenta: safeInitialData.cuenta?._id || safeInitialData.cuenta || '',
    deposito: safeInitialData.deposito?.toString() || '0',
    observaciones: safeInitialData.observaciones || '',
    documentoUrl: safeInitialData.documentoUrl || '',
    estado: safeInitialData.estado || 'PLANEADO',
    tipoContrato: safeInitialData.tipoContrato || 'ALQUILER',
    cuotasMensuales: safeInitialData.cuotasMensuales || []
  });

  const [errors, setErrors] = useState({});
  const [selectedPropiedad, setSelectedPropiedad] = useState(null);
  const [selectedHabitacion, setSelectedHabitacion] = useState(null);
  const [selectedInquilinos, setSelectedInquilinos] = useState([]);
  const [selectedCuenta, setSelectedCuenta] = useState(null);

  // Función local para normalizar cuotas (sin necesidad del contexto)
  const normalizarCuotas = (cuotas) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return cuotas.map(cuota => {
      if (cuota.estado === 'PAGADO') return { ...cuota, estado: 'PAGADO' };
      const fechaVencimiento = new Date(cuota.fechaVencimiento);
      fechaVencimiento.setHours(0, 0, 0, 0);
      if (hoy > fechaVencimiento) {
        return { ...cuota, estado: 'VENCIDA' };
      } else {
        return { ...cuota, estado: 'PENDIENTE' };
      }
    });
  };

  useEffect(() => {
    let propiedadObj = null;
    if (relatedData.propiedades?.length > 0 && safeInitialData.propiedad) {
      const propiedadId = getDocumentId(safeInitialData.propiedad);
      propiedadObj = relatedData.propiedades.find((p) => getDocumentId(p) === propiedadId);
      setSelectedPropiedad(propiedadObj || null);
    }

    let cuentaObj = null;
    if (relatedData.cuentas?.length > 0 && safeInitialData.cuenta) {
      const cuentaId = getDocumentId(safeInitialData.cuenta);
      cuentaObj = relatedData.cuentas.find((c) => getDocumentId(c) === cuentaId);
      setSelectedCuenta(cuentaObj || null);
    }

    if (relatedData.inquilinos?.length > 0 && safeInitialData.inquilino) {
      const inquilinos = Array.isArray(safeInitialData.inquilino) ? safeInitialData.inquilino : [safeInitialData.inquilino];
      const selectedInqs = inquilinos
        .map((inqId) => relatedData.inquilinos.find((i) => getDocumentId(i) === getDocumentId(inqId)))
        .filter(Boolean);
      setSelectedInquilinos(selectedInqs);
    }

    if (relatedData.habitaciones?.length > 0 && safeInitialData.habitacion) {
      const habitacionId = getDocumentId(safeInitialData.habitacion);
      const habitacion = relatedData.habitaciones.find((h) => getDocumentId(h) === habitacionId);
      setSelectedHabitacion(habitacion || null);
    }

    setFormData(prev => ({
      ...prev,
      propiedad: getDocumentId(propiedadObj) || '',
      cuenta: getDocumentId(cuentaObj) || '',
      precioTotal: safeInitialData.precioTotal?.toString() || '0',
      deposito: safeInitialData.deposito?.toString() || '0',
      inquilino: (Array.isArray(safeInitialData.inquilino) ? safeInitialData.inquilino : [safeInitialData.inquilino]).map((i) => getDocumentId(i)).filter(Boolean),
      cuotasMensuales: safeInitialData.cuotasMensuales || []
    }));
  }, [safeInitialData, relatedData]);

  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTipoContratoChange = (tipoContrato) => {
    const esMantenimiento = tipoContrato === 'MANTENIMIENTO';
    
    setFormData(prev => ({
      ...prev,
      tipoContrato,
      precioTotal: esMantenimiento ? '0' : (prev.precioTotal || '0'),
      inquilino: esMantenimiento ? [] : prev.inquilino,
      cuotasMensuales: esMantenimiento ? [] : prev.cuotasMensuales,
      cuenta: esMantenimiento ? '' : prev.cuenta,
      deposito: esMantenimiento ? '0' : prev.deposito
    }));
    
    if (esMantenimiento) {
      setSelectedInquilinos([]);
      setSelectedCuenta(null);
    }
    
    setErrors(prev => {
      const newErrors = { ...prev };
      if (esMantenimiento) {
        delete newErrors.inquilino;
        delete newErrors.precioTotal;
        delete newErrors.cuenta;
        delete newErrors.deposito;
      }
      return newErrors;
    });
  };

  const handlePropiedadChange = (newValue) => {
    setSelectedPropiedad(newValue);
    handleChange('propiedad', getDocumentId(newValue));
    setSelectedHabitacion(null);
    handleChange('habitacion', '');
  };

  const handleTipoAlquilerChange = (valor) => {
    handleChange('esPorHabitacion', valor);
    if (!valor) {
      setSelectedHabitacion(null);
      handleChange('habitacion', '');
    }
  };

  const handleHabitacionChange = (newValue) => {
    setSelectedHabitacion(newValue);
    handleChange('habitacion', getDocumentId(newValue));
  };

  const handleInquilinosChange = (newValue) => {
    setSelectedInquilinos(newValue);
    handleChange('inquilino', newValue.map((inq) => getDocumentId(inq)));
  };

  const handleCuentaChange = (newValue) => {
    setSelectedCuenta(newValue);
    handleChange('cuenta', getDocumentId(newValue));
  };

  const handleCuotasChange = (cuotas) => {
    handleChange('cuotasMensuales', cuotas);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const dataToSubmit = {
        ...formData,
        propiedad: formData.propiedad || selectedPropiedad?._id || null,
        habitacion: formData.habitacion || null,
        inquilino: formData.tipoContrato === 'MANTENIMIENTO' ? [] : (formData.inquilino || []),
        cuenta: formData.tipoContrato === 'MANTENIMIENTO' ? null : (formData.cuenta || (selectedCuenta ? selectedCuenta._id : null)),
        precioTotal: formData.tipoContrato === 'MANTENIMIENTO' ? 0 : 
                    (formData.precioTotal && parseFloat(formData.precioTotal) > 0 ? parseFloat(formData.precioTotal) : 
                     (initialData.precioTotal && initialData.tipoContrato !== 'MANTENIMIENTO' ? parseFloat(initialData.precioTotal) : 0)),
        deposito: formData.tipoContrato === 'MANTENIMIENTO' ? 0 : parseFloat(formData.deposito || 0),
        fechaInicio: formData.fechaInicio?.toISOString(),
        fechaFin: formData.fechaFin?.toISOString(),
        observaciones: formData.observaciones || '',
        documentoUrl: formData.documentoUrl || '',
        tipoContrato: formData.tipoContrato,
        esMantenimiento: formData.tipoContrato === 'MANTENIMIENTO',
        cuotasMensuales: formData.tipoContrato === 'MANTENIMIENTO' ? [] : normalizarCuotas(formData.cuotasMensuales || [])
      };
      delete dataToSubmit.estado;

      if (!dataToSubmit.fechaInicio || !dataToSubmit.fechaFin) {
        throw new Error('Las fechas son requeridas');
      }

      // Asegurarse de que la cuenta esté correctamente asignada
      if (dataToSubmit.tipoContrato === 'MANTENIMIENTO') {
        dataToSubmit.cuenta = null;
        dataToSubmit.moneda = null;
      } else {
        if (!dataToSubmit.cuenta) {
          if (selectedCuenta) {
            dataToSubmit.cuenta = selectedCuenta._id;
          } else if (initialData.cuenta && initialData.tipoContrato !== 'MANTENIMIENTO') {
            dataToSubmit.cuenta = typeof initialData.cuenta === 'object' ? initialData.cuenta._id : initialData.cuenta;
          }
        }
      }

      Object.keys(dataToSubmit).forEach(key => {
        if (dataToSubmit[key] === null || dataToSubmit[key] === undefined) {
          if (key === 'precioTotal' && dataToSubmit.tipoContrato !== 'MANTENIMIENTO') {
            // Mantener precioTotal para contratos no mantenimiento
          } else if (key !== 'precioTotal' && key !== 'inquilino') {
            delete dataToSubmit[key];
          }
        }
      });

      console.log('=== DATOS FINALES A ENVIAR ===');
      console.log('selectedPropiedad:', selectedPropiedad);
      console.log('formData.propiedad:', formData.propiedad);
      console.log('propiedad final:', dataToSubmit.propiedad);
      console.log('dataToSubmit completo:', dataToSubmit);

      await onSubmit(dataToSubmit);
      onClose();
    } catch (error) {
      console.error('Error en submit:', error);
      setErrors(prev => ({
        ...prev,
        submit: error.message || 'Error al guardar el contrato'
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fechaInicio) {
      newErrors.fechaInicio = 'La fecha de inicio es requerida';
    }
    if (!formData.fechaFin) {
      newErrors.fechaFin = 'La fecha de fin es requerida';
    }
    if (formData.fechaInicio && formData.fechaFin && formData.fechaInicio > formData.fechaFin) {
      newErrors.fechaFin = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }

    if (!formData.propiedad && !selectedPropiedad) {
      newErrors.propiedad = 'La propiedad es requerida';
    }
    if (formData.esPorHabitacion && !formData.habitacion) {
      newErrors.habitacion = 'La habitación es requerida';
    }

    if (formData.tipoContrato !== 'MANTENIMIENTO' && (!formData.inquilino || formData.inquilino.length === 0)) {
      newErrors.inquilino = 'Debe seleccionar al menos un inquilino';
    }

    if (formData.tipoContrato !== 'MANTENIMIENTO') {
      if (!formData.precioTotal || parseFloat(formData.precioTotal) <= 0) {
        newErrors.precioTotal = 'El precio total debe ser mayor a 0';
      }
      if (formData.deposito && parseFloat(formData.deposito) < 0) {
        newErrors.deposito = 'El depósito no puede ser negativo';
      }
    } else {
      if (formData.precioTotal && parseFloat(formData.precioTotal) !== 0) {
        newErrors.precioTotal = 'Los contratos de mantenimiento no tienen precio total';
      }
    }

    if (formData.tipoContrato !== 'MANTENIMIENTO' && !formData.cuenta && !selectedCuenta) {
      newErrors.cuenta = 'La cuenta es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <StyledDialog
      open={open}
      onClose={!isSaving ? onClose : undefined}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header minimal */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 1.5,
          borderBottom: t => `1px solid ${t.palette.divider}`,
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {formData.tipoContrato === 'MANTENIMIENTO' ? (
              <Engineering sx={{ color: 'warning.main', fontSize: 20 }} />
            ) : (
              <Description sx={{ color: 'primary.main', fontSize: 20 }} />
            )}
            <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
              {initialData._id ? 'Editar' : 'Nuevo'} Contrato
            </Typography>
          </Box>
          <IconButton 
            onClick={onClose} 
            disabled={isSaving} 
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {isSaving && <LinearProgress sx={{ height: 1 }} />}

        {/* Content minimal */}
        <DialogContent sx={{ p: 2, bgcolor: 'background.default', flex: 1, overflowY: 'auto' }}>
          <Box component="form" onSubmit={handleSubmit} id="contrato-form">
            
            {/* Tipo de contrato simplificado */}
            <FormSection>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant={formData.tipoContrato === 'ALQUILER' ? 'outlined' : 'contained'}
                  size="small"
                  onClick={() => handleTipoContratoChange('ALQUILER')}
                  startIcon={<Description />}
                  sx={{ 
                    borderRadius: 0, 
                    minWidth: 120,
                    opacity: formData.tipoContrato === 'ALQUILER' ? 1 : 0.6
                  }}
                >
                  Alquiler
                </Button>
                <Button
                  variant={formData.tipoContrato === 'MANTENIMIENTO' ? 'outlined' : 'contained'}
                  size="small"
                  onClick={() => handleTipoContratoChange('MANTENIMIENTO')}
                  startIcon={<Engineering />}
                  sx={{ 
                    borderRadius: 0, 
                    minWidth: 120,
                    opacity: formData.tipoContrato === 'MANTENIMIENTO' ? 1 : 0.6
                  }}
                >
                  Mantenimiento
                </Button>
              </Box>
            </FormSection>

            <ContratoPropiedadSection
              formData={formData}
              selectedPropiedad={selectedPropiedad}
              onPropiedadChange={handlePropiedadChange}
              onTipoAlquilerChange={handleTipoAlquilerChange}
              relatedData={relatedData}
              errors={errors}
            />

            <ContratoHabitacionSection
              selectedHabitacion={selectedHabitacion}
              onHabitacionChange={handleHabitacionChange}
              relatedData={relatedData}
              formData={formData}
              errors={errors}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <CommonDate
                label="Fecha de Inicio"
                value={formData.fechaInicio}
                onChange={(newValue) => handleChange('fechaInicio', newValue)}
                error={!!errors.fechaInicio}
                helperText={errors.fechaInicio}
              />
              <CommonDate
                label="Fecha de Fin"
                value={formData.fechaFin}
                onChange={(newValue) => handleChange('fechaFin', newValue)}
                error={!!errors.fechaFin}
                helperText={errors.fechaFin}
                minDate={formData.fechaInicio}
              />
            </Box>

            {formData.tipoContrato !== 'MANTENIMIENTO' && (
              <>
                <ContratoInquilinosSection
                  selectedInquilinos={selectedInquilinos}
                  onInquilinosChange={handleInquilinosChange}
                  relatedData={relatedData}
                  errors={errors}
                />

                <ContratoMontosSection
                  formData={formData}
                  selectedCuenta={selectedCuenta}
                  onCuentaChange={handleCuentaChange}
                  onMontoChange={handleChange}
                  relatedData={relatedData}
                  errors={errors}
                />

                <CuotasProvider contratoId={initialData._id || initialData.id || 'temp-form'} formData={formData}>
                <ContratoCuotasSection
                  formData={formData}
                  onCuotasChange={handleCuotasChange}
                  errors={errors}
                  theme={theme}
                />
                </CuotasProvider>
              </>
            )}
          </Box>
        </DialogContent>

        {/* Actions minimal */}
        <DialogActions sx={{ p: 1.5, bgcolor: 'background.paper', borderTop: t => `1px solid ${t.palette.divider}` }}>
          <Button 
            onClick={onClose} 
            disabled={isSaving}
            size="small"
            sx={{ borderRadius: 0, minWidth: 80 }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="contrato-form"
            variant="contained"
            disabled={isSaving}
            size="small"
            sx={{ borderRadius: 0, minWidth: 80, position: 'relative' }}
          >
            {isSaving ? (
              <>
                <CircularProgress size={14} sx={{ position: 'absolute', left: '50%', marginLeft: '-7px' }} />
                <Box sx={{ opacity: 0 }}>
                  {initialData._id ? 'Actualizar' : 'Crear'}
                </Box>
              </>
            ) : (
              initialData._id ? 'Actualizar' : 'Crear'
            )}
          </Button>
        </DialogActions>
      </Box>
    </StyledDialog>
  );
};

export default ContratoForm; 
