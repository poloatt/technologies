import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  LinearProgress,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Paper,
  InputAdornment,
  Chip,
  Autocomplete,
  Switch,
  FormControlLabel
} from '@shared/utils/materialImports';
import { styled } from '@shared/utils/materialImports';
import { FORM_HEIGHTS } from '@shared/config/uiConstants';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useSnackbar } from 'notistack';
import { useRelationalData } from '@shared/hooks/useRelationalData';
import {
  HealthAndSafety,
  Receipt,
  DirectionsBus,
  Fastfood,
  LocalBar as Cocktail,
  Checkroom as Shirt,
  Devices,
  MoreHoriz,
} from '@mui/icons-material';
import { TransaccionRecurrenteForm } from '../recurrente';
import clienteAxios from '@shared/config/axios';
import { getEstadoColor } from '@shared/components/common/StatusSystem';
import { alpha } from '@mui/material/styles';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 0,
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
    [theme.breakpoints.down('sm')]: {
      margin: 0,
      maxHeight: '100%',
      height: '100%',
      width: '100%',
      maxWidth: '100%'
    },
    [theme.breakpoints.up('sm')]: {
      minWidth: '600px',
      maxWidth: '800px'
    }
  }
}));

// Helper para obtener colores de estados desde StatusSystem
const getEstadoColorForToggle = (estado) => {
  if (estado === 'PAGADO') {
    return getEstadoColor('COMPLETADA', 'TRANSACCION');
  }
  if (estado === 'PENDIENTE') {
    return getEstadoColor('PENDIENTE', 'TRANSACCION');
  }
  return null;
};

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  borderRadius: 0,
  padding: theme.spacing(1),
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderColor: theme.palette.divider,
  color: theme.palette.text.secondary,
  height: FORM_HEIGHTS.input,
  '& .MuiSvgIcon-root': {
    fontSize: 18
  },
  '&.Mui-selected': {
    backgroundColor: props => {
      if (props.value === 'INGRESO') return 'rgba(90, 155, 95, 0.15)';
      if (props.value === 'EGRESO') return 'rgba(177, 87, 87, 0.15)';
      const estadoColor = getEstadoColorForToggle(props.value);
      if (estadoColor) return alpha(estadoColor, 0.15);
      return 'inherit';
    },
    color: props => {
      if (props.value === 'INGRESO') return '#5a9b5f';
      if (props.value === 'EGRESO') return '#b15757';
      const estadoColor = getEstadoColorForToggle(props.value);
      if (estadoColor) return estadoColor;
      return 'inherit';
    },
    '&:hover': {
      backgroundColor: props => {
        if (props.value === 'INGRESO') return 'rgba(90, 155, 95, 0.25)';
        if (props.value === 'EGRESO') return 'rgba(177, 87, 87, 0.25)';
        const estadoColor = getEstadoColorForToggle(props.value);
        if (estadoColor) return alpha(estadoColor, 0.25);
        return 'inherit';
      }
    }
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}));

const CategoryGroup = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  borderRadius: 0,
  backgroundColor: theme.palette.background.paper
}));

const CATEGORIAS = [
  { valor: 'Contabilidad y Facturas', icon: <Receipt sx={{ fontSize: 18 }} />, color: '#7bba7f' },
  { valor: 'Comida y Mercado', icon: <Fastfood sx={{ fontSize: 18 }} />, color: '#ffb74d' },
  { valor: 'Salud y Belleza', icon: <HealthAndSafety sx={{ fontSize: 18 }} />, color: '#ef5350' },
  { valor: 'Ropa', icon: <Shirt sx={{ fontSize: 18 }} />, color: '#ba68c8' },
  { valor: 'Fiesta', icon: <Cocktail sx={{ fontSize: 18 }} />, color: '#9575cd' },
  { valor: 'Transporte', icon: <DirectionsBus sx={{ fontSize: 18 }} />, color: '#64b5f6' },
  { valor: 'Tecnología', icon: <Devices sx={{ fontSize: 18 }} />, color: '#90a4ae' },
  { valor: 'Otro', icon: <MoreHoriz sx={{ fontSize: 18 }} />, color: '#a1887f' }
];

const CategoryChip = styled(Chip)(({ theme }) => ({
  borderRadius: 0,
  height: FORM_HEIGHTS.input,
  width: '100%',
  transition: 'all 0.2s ease',
  backgroundColor: 'transparent',
  border: 'none',
  '& .MuiChip-icon': {
    margin: 0,
    fontSize: 18,
    transition: 'color 0.2s ease'
  },
  '& .MuiChip-label': {
    display: 'none'
  },
  '&:hover': {
    backgroundColor: 'transparent'
  }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    height: FORM_HEIGHTS.input,
    backgroundColor: theme.palette.background.default,
    '& fieldset': {
      borderColor: theme.palette.divider
    }
  },
  '& .MuiInputLabel-root': {
    transform: 'translate(14px, -9px) scale(0.75)',
    '&.Mui-focused, &.MuiFormLabel-filled': {
      transform: 'translate(14px, -9px) scale(0.75)'
    }
  },
  '& .MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)'
  }
}));

const TransaccionForm = ({ 
  open, 
  onClose, 
  onSubmit,
  initialData = {},
  isEditing = false 
}) => {
  const [formData, setFormData] = useState({
    tipo: initialData.tipo || 'INGRESO',
    estado: initialData.estado || 'PENDIENTE',
    monto: initialData.monto || '',
    descripcion: initialData.descripcion || '',
    categoria: initialData.categoria || '',
    fecha: initialData.fecha ? new Date(initialData.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    cuenta: '',
    moneda: ''
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  
  // Definición de campos relacionales antes del hook
  const relatedFields = [
    { 
      type: 'relational',
      name: 'cuenta',
      endpoint: '/cuentas',
      labelField: 'nombre',
      populate: ['moneda']
    }
  ];

  const { relatedData, isLoading: isLoadingRelated } = useRelationalData({
    open,
    relatedFields
  });

  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [isRecurrente, setIsRecurrente] = useState(false);

  // Efecto para reiniciar el formulario cuando se abre
  useEffect(() => {
    if (open) {
      console.log('Reiniciando formulario con datos:', initialData);
      setFormData({
        tipo: initialData.tipo || 'INGRESO',
        estado: initialData.estado || 'PENDIENTE',
        monto: initialData.monto || '',
        descripcion: initialData.descripcion || '',
        categoria: initialData.categoria || '',
        fecha: initialData.fecha ? new Date(initialData.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        cuenta: '',
        moneda: ''
      });
      setSelectedCuenta(null);
      setErrors({});
    }
  }, [open]);

  // Efecto para manejar la cuenta cuando los datos relacionales están disponibles
  useEffect(() => {
    const inicializarCuenta = () => {
      if (!relatedData?.cuenta?.length || !initialData.cuenta) return;

      console.log('Inicializando cuenta con:', {
        initialData,
        cuentaInicial: initialData.cuenta,
        cuentasDisponibles: relatedData.cuenta
      });

      let cuentaId;
      if (typeof initialData.cuenta === 'string') {
        cuentaId = initialData.cuenta;
      } else if (initialData.cuenta?._id) {
        cuentaId = initialData.cuenta._id;
      } else if (initialData.cuenta?.id) {
        cuentaId = initialData.cuenta.id;
      }

      console.log('Buscando cuenta con ID:', cuentaId);

      const cuentaEncontrada = relatedData.cuenta.find(c => 
        c._id === cuentaId || c.id === cuentaId
      );

      console.log('Cuenta encontrada:', cuentaEncontrada);

      if (cuentaEncontrada) {
        setSelectedCuenta(cuentaEncontrada);
        setFormData(prev => ({
          ...prev,
          cuenta: cuentaEncontrada._id || cuentaEncontrada.id,
          moneda: cuentaEncontrada.moneda?._id || cuentaEncontrada.moneda?.id || cuentaEncontrada.moneda
        }));
      }
    };

    if (open && !isLoadingRelated) {
      inicializarCuenta();
    }
  }, [relatedData?.cuenta, initialData.cuenta, open, isLoadingRelated]);

  const handleChange = useCallback((name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleMontoChange = (event) => {
    const value = event.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      handleChange('monto', value);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Preparar los datos para enviar
      const dataToSubmit = {
        ...formData,
        monto: parseFloat(formData.monto),
        fecha: formData.fecha || new Date().toISOString(),
        estado: formData.estado || 'PENDIENTE',
        cuenta: selectedCuenta?.id || selectedCuenta?._id || formData.cuenta
      };

      console.log('Cuenta seleccionada:', selectedCuenta);
      console.log('Datos a enviar:', dataToSubmit);
      await onSubmit(dataToSubmit);
      enqueueSnackbar(
        isEditing ? 'Transacción actualizada' : 'Transacción guardada', 
        { variant: 'success' }
      );
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      enqueueSnackbar(
        error.response?.data?.message || error.message || 'Error al guardar', 
        { variant: 'error' }
      );
    } finally {
      setIsSaving(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.tipo) newErrors.tipo = 'Seleccione el tipo';
    if (!formData.monto) newErrors.monto = 'Ingrese el monto';
    if (!formData.descripcion) newErrors.descripcion = 'Ingrese una descripción';
    if (!formData.categoria) newErrors.categoria = 'Seleccione una categoría';
    if (!selectedCuenta) newErrors.cuenta = 'Seleccione una cuenta';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRecurrenteToggle = () => {
    setIsRecurrente(prev => !prev);
  };

  const handleRecurrenteSubmit = async (recurrenteData) => {
    try {
      // Preparar datos para enviar
      const datosAEnviar = {
        ...recurrenteData,
        estado: 'ACTIVO', // Estado inicial siempre ACTIVO
        origen: {
          tipo: 'MANUAL',
          referencia: null
        }
      };

      // Eliminar propiedad si está vacía
      if (!datosAEnviar.propiedad) {
        delete datosAEnviar.propiedad;
      }

      // Eliminar campos que no corresponden al modelo recurrente
      delete datosAEnviar.fecha;
      delete datosAEnviar.moneda;

      console.log('Enviando datos a transacciones recurrentes:', datosAEnviar);

      let response;
      if (isEditing) {
        response = await clienteAxios.put(`/api/transaccionesrecurrentes/${initialData._id}`, datosAEnviar);
      } else {
        response = await clienteAxios.post('/api/transaccionesrecurrentes', datosAEnviar);
      }

      enqueueSnackbar(
        isEditing ? 'Transacción recurrente actualizada' : 'Transacción recurrente guardada', 
        { variant: 'success' }
      );
      onClose();
    } catch (error) {
      console.error('Error al guardar transacción recurrente:', error);
      enqueueSnackbar(
        error.response?.data?.message || error.message || 'Error al guardar', 
        { variant: 'error' }
      );
    }
  };

  if (isRecurrente) {
    return (
      <TransaccionRecurrenteForm
        open={open}
        onClose={() => {
          setIsRecurrente(false);
          onClose();
        }}
        onSubmit={handleRecurrenteSubmit}
        initialData={{
          ...formData,
          cuenta: selectedCuenta?._id || selectedCuenta?.id || formData.cuenta,
          fechaInicio: formData.fecha,
          diaDelMes: new Date(formData.fecha).getDate().toString()
        }}
        relatedData={{
          cuentas: relatedData?.cuenta || [],
          propiedades: []
        }}
        isEditing={isEditing}
        onSwitchToSimple={(data) => {
          setIsRecurrente(false);
          setFormData(prev => ({
            ...prev,
            ...data
          }));
        }}
      />
    );
  }

  return (
    <StyledDialog
      open={open}
      onClose={!isSaving ? onClose : undefined}
      maxWidth="md"
      fullWidth
    >
      <Box sx={{ position: 'relative' }}>
        <DialogTitle sx={{ px: 3, py: 2 }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="h6" sx={{ 
              color: isSaving ? 'text.secondary' : 'text.primary' 
            }}>
              {isEditing ? 'Editar Transacción' : 'Nueva Transacción'}
            </Typography>
            <IconButton
              onClick={onClose}
              size="small"
              sx={{ 
                color: 'text.secondary',
                borderRadius: 0
              }}
              disabled={isSaving}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>
        <Fade in={isSaving}>
          <LinearProgress 
            sx={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              right: 0,
              height: 2
            }} 
          />
        </Fade>
      </Box>

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Box component="form" onSubmit={handleSubmit}>
          {/* Tipo de Transacción */}
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={formData.tipo}
              exclusive
              onChange={(_, value) => value && handleChange('tipo', value)}
              fullWidth
              sx={{ 
                height: FORM_HEIGHTS.input,
                '& .MuiToggleButton-root': {
                  flex: 1
                }
              }}
            >
              <StyledToggleButton value="INGRESO">
                <AddIcon sx={{ fontSize: 18 }} />
                <Typography variant="subtitle2">Ingreso</Typography>
              </StyledToggleButton>
              <StyledToggleButton value="EGRESO">
                <RemoveIcon sx={{ fontSize: 18 }} />
                <Typography variant="subtitle2">Egreso</Typography>
              </StyledToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Monto y Estado */}
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            mb: 2,
            alignItems: 'flex-start'
          }}>
            <StyledTextField
              fullWidth
              label="Monto"
              value={formData.monto || ''}
              onChange={handleMontoChange}
              error={!!errors.monto}
              helperText={errors.monto}
              InputProps={{
                startAdornment: selectedCuenta?.moneda && (
                  <InputAdornment position="start">
                    {selectedCuenta.moneda.simbolo}
                  </InputAdornment>
                )
              }}
            />
            <ToggleButtonGroup
              value={formData.estado}
              exclusive
              onChange={(_, value) => value && handleChange('estado', value)}
              sx={{
                minWidth: 'fit-content',
                height: FORM_HEIGHTS.input,
                '& .MuiToggleButton-root': {
                  px: 2,
                  borderRadius: 0
                }
              }}
            >
              <ToggleButton value="PAGADO">
                <CheckCircleIcon sx={{ fontSize: 18 }} />
                <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                  Pago
                </Typography>
              </ToggleButton>
              <ToggleButton value="PENDIENTE">
                <PendingIcon sx={{ fontSize: 18 }} />
                <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                  Pendiente
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Descripción */}
          <StyledTextField
            fullWidth
            label="Descripción"
            value={formData.descripcion || ''}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            error={!!errors.descripcion}
            helperText={errors.descripcion}
            sx={{ mb: 2 }}
            InputLabelProps={{
              shrink: true
            }}
          />

          {/* Cuenta */}
          <Autocomplete
            key={`cuenta-${open}-${selectedCuenta?.id || 'new'}`}
            value={selectedCuenta}
            onChange={(event, newValue) => {
              console.log('Cuenta seleccionada:', newValue);
              setSelectedCuenta(newValue);
              if (newValue) {
                setFormData(prev => ({
                  ...prev,
                  cuenta: newValue._id || newValue.id,
                  moneda: newValue.moneda?._id || newValue.moneda?.id || newValue.moneda
                }));
              } else {
                setFormData(prev => ({
                  ...prev,
                  cuenta: '',
                  moneda: ''
                }));
              }
            }}
            options={relatedData?.cuenta || []}
            getOptionLabel={(option) => `${option?.nombre || ''} - ${option?.tipo || ''}`}
            loading={isLoadingRelated}
            renderInput={(params) => (
              <StyledTextField
                {...params}
                label="Cuenta"
                error={!!errors.cuenta}
                helperText={errors.cuenta}
                InputLabelProps={{
                  ...params.InputLabelProps,
                  shrink: true
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => 
              option?._id === value?._id || 
              option?.id === value?.id
            }
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box 
                  key={key} 
                  component="li" 
                  {...otherProps}
                  sx={{ 
                    py: 1,
                    px: 2,
                    borderBottom: t => `1px solid ${t.palette.divider}`,
                    '&:last-child': {
                      borderBottom: 'none'
                    }
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2">{option.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.moneda?.simbolo} - {option.tipo}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
          />

          {/* Categorías */}
          <Box sx={{ mt: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 1,
              gap: 1
            }}>
              <Typography variant="subtitle2">
                Categoría
              </Typography>
              {formData.categoria && (
                <Typography variant="caption" color="text.secondary">
                  {formData.categoria}
                </Typography>
              )}
            </Box>
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(4, 1fr)',
                sm: 'repeat(8, 1fr)'
              },
              gap: 1
            }}>
              {CATEGORIAS.map((categoria) => (
                <CategoryChip
                  key={categoria.valor}
                  icon={categoria.icon}
                  onClick={() => handleChange('categoria', categoria.valor)}
                  sx={{ 
                    '& .MuiChip-icon': {
                      color: formData.categoria === categoria.valor ? 
                        categoria.color : 
                        'text.secondary'
                    },
                    '&:hover': {
                      '& .MuiChip-icon': {
                        color: categoria.color
                      }
                    }
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Switch Recurrente */}
          <Box sx={{ 
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
            borderTop: t => `1px solid ${t.palette.divider}`,
            pt: 2
          }}>
            <Typography variant="body2" color="text.secondary">
              ¿Es una transacción recurrente?
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={isRecurrente}
                  onChange={handleRecurrenteToggle}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutorenewIcon sx={{ fontSize: 18 }} />
                  <Typography variant="caption">Recurrente</Typography>
                </Box>
              }
              sx={{ 
                m: 0,
                '& .MuiFormControlLabel-label': {
                  color: 'text.secondary'
                }
              }}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        py: 2,
        borderTop: t => `1px solid ${t.palette.divider}`,
        gap: 1
      }}>
        <Button 
          onClick={onClose} 
          disabled={isSaving}
          sx={{ 
            borderRadius: 0,
            height: FORM_HEIGHTS.button
          }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSaving}
          sx={{ 
            borderRadius: 0,
            height: FORM_HEIGHTS.button
          }}
        >
          {isSaving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default TransaccionForm; 