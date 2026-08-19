import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch
} from '@mui/material';
import { styled, alpha } from '@shared/utils/materialImports';
import { FORM_HEIGHTS } from '@shared/config/uiConstants';
import {
  Close as CloseIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  AccountBalance as BankIcon,
  Category as CategoryIcon,
  AutorenewOutlined as RecurrentIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  HealthAndSafety,
  Receipt,
  DirectionsBus,
  Fastfood,
  LocalBar as Cocktail,
  Checkroom as Shirt,
  Devices,
  MoreHoriz,
  Autorenew as AutorenewIcon,
} from '@mui/icons-material';
import { CommonDate } from '@shared/components/common/CommonDate';
import clienteAxios from '@shared/config/axios';

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
      return 'inherit';
    },
    color: props => {
      if (props.value === 'INGRESO') return '#5a9b5f';
      if (props.value === 'EGRESO') return '#b15757';
      return 'inherit';
    },
    '&:hover': {
      backgroundColor: props => {
        if (props.value === 'INGRESO') return 'rgba(90, 155, 95, 0.25)';
        if (props.value === 'EGRESO') return 'rgba(177, 87, 87, 0.25)';
        return 'inherit';
      }
    }
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
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

const TransaccionRecurrenteForm = ({
  open,
  onClose,
  onSubmit,
  initialData = {},
  relatedData = {},
  isEditing = false,
  onSwitchToSimple
}) => {
  const [formData, setFormData] = useState({
    descripcion: '',
    monto: '',
    cuenta: '',
    tipo: 'INGRESO',
    categoria: '',
    frecuencia: 'MENSUAL',
    diaDelMes: '1',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: null,
    propiedad: '',
    estado: 'ACTIVO',
    ...initialData
  });

  const [errors, setErrors] = useState({});
  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [selectedPropiedad, setSelectedPropiedad] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({
        descripcion: '',
        monto: '',
        cuenta: '',
        tipo: 'INGRESO',
        categoria: '',
        frecuencia: 'MENSUAL',
        diaDelMes: '1',
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: null,
        propiedad: '',
        estado: 'ACTIVO',
        ...initialData
      });
      
      if (initialData?.cuenta && relatedData?.cuentas) {
        const cuenta = relatedData.cuentas.find(c => 
          c._id === (typeof initialData.cuenta === 'object' ? initialData.cuenta._id : initialData.cuenta)
        );
        setSelectedCuenta(cuenta || null);
      }

      if (initialData?.propiedad && relatedData?.propiedades) {
        const propiedad = relatedData.propiedades.find(p => 
          p._id === (typeof initialData.propiedad === 'object' ? initialData.propiedad._id : initialData.propiedad)
        );
        setSelectedPropiedad(propiedad || null);
      }
    }
  }, [open, initialData, relatedData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const dataToSubmit = {
        ...formData,
        monto: parseFloat(formData.monto),
        cuenta: selectedCuenta?._id || selectedCuenta?.id || formData.cuenta,
        propiedad: selectedPropiedad?._id || selectedPropiedad?.id || formData.propiedad,
        diaDelMes: parseInt(formData.diaDelMes)
      };

      if (isEditing) {
        await clienteAxios.put(`/api/transaccionesrecurrentes/${initialData._id}`, dataToSubmit);
      } else {
        await onSubmit(dataToSubmit);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      setErrors(prev => ({
        ...prev,
        submit: error.message || 'Error al guardar la transacción recurrente'
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.tipo) newErrors.tipo = 'Seleccione el tipo';
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      newErrors.monto = 'El monto debe ser mayor a 0';
    }
    if (!formData.descripcion) newErrors.descripcion = 'Ingrese una descripción';
    if (!formData.categoria) newErrors.categoria = 'Seleccione una categoría';
    if (!selectedCuenta) newErrors.cuenta = 'Seleccione una cuenta';
    if (!formData.frecuencia) newErrors.frecuencia = 'Seleccione la frecuencia';
    if (!formData.diaDelMes || parseInt(formData.diaDelMes) < 1 || parseInt(formData.diaDelMes) > 31) {
      newErrors.diaDelMes = 'El día debe estar entre 1 y 31';
    }
    if (!formData.fechaInicio) newErrors.fechaInicio = 'Seleccione la fecha de inicio';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSwitchToSimple = () => {
    if (onSwitchToSimple) {
      onSwitchToSimple({
        ...formData,
        fecha: formData.fechaInicio,
        cuenta: selectedCuenta?._id || selectedCuenta?.id || formData.cuenta
      });
    }
  };

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
              {isEditing ? 'Editar Transacción Recurrente' : 'Nueva Transacción Recurrente'}
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

          {/* Monto y Frecuencia */}
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            mb: 2,
            alignItems: 'flex-start'
          }}>
            <StyledTextField
              fullWidth
              label="Monto"
              value={formData.monto}
              onChange={(e) => handleChange('monto', e.target.value)}
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
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Frecuencia</InputLabel>
              <Select
                value={formData.frecuencia}
                onChange={(e) => handleChange('frecuencia', e.target.value)}
                label="Frecuencia"
                error={!!errors.frecuencia}
                sx={{ height: FORM_HEIGHTS.input, borderRadius: 0 }}
              >
                <MenuItem value="MENSUAL">Mensual</MenuItem>
                <MenuItem value="TRIMESTRAL">Trimestral</MenuItem>
                <MenuItem value="SEMESTRAL">Semestral</MenuItem>
                <MenuItem value="ANUAL">Anual</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Descripción */}
          <StyledTextField
            fullWidth
            label="Descripción"
            value={formData.descripcion}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            error={!!errors.descripcion}
            helperText={errors.descripcion}
            sx={{ mb: 2 }}
          />

          {/* Cuenta */}
          <Autocomplete
            value={selectedCuenta}
            onChange={(_, newValue) => {
              setSelectedCuenta(newValue);
              handleChange('cuenta', newValue?._id || newValue?.id || '');
            }}
            options={relatedData?.cuentas || []}
            getOptionLabel={(option) => `${option?.nombre || ''} - ${option?.tipo || ''}`}
            renderInput={(params) => (
              <StyledTextField
                {...params}
                label="Cuenta"
                error={!!errors.cuenta}
                helperText={errors.cuenta}
              />
            )}
            sx={{ mb: 2 }}
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
            pt: 2,
            mb: 2
          }}>
            <Typography variant="body2" color="text.secondary">
              Configuración de recurrencia
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={true}
                    onChange={handleSwitchToSimple}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AutorenewIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="caption" color="primary">Activa</Typography>
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

          {/* Campos específicos de recurrencia */}
          <Paper sx={{ 
            p: 2, 
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Configuración de repetición
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              mb: 2
            }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Frecuencia</InputLabel>
                <Select
                  value={formData.frecuencia}
                  onChange={(e) => handleChange('frecuencia', e.target.value)}
                  label="Frecuencia"
                  error={!!errors.frecuencia}
                  sx={{ height: FORM_HEIGHTS.input, borderRadius: 0 }}
                >
                  <MenuItem value="MENSUAL">Mensual</MenuItem>
                  <MenuItem value="TRIMESTRAL">Trimestral</MenuItem>
                  <MenuItem value="SEMESTRAL">Semestral</MenuItem>
                  <MenuItem value="ANUAL">Anual</MenuItem>
                </Select>
              </FormControl>

              <StyledTextField
                label="Día del mes"
                type="number"
                value={formData.diaDelMes}
                onChange={(e) => handleChange('diaDelMes', e.target.value)}
                error={!!errors.diaDelMes}
                helperText={errors.diaDelMes}
                inputProps={{ min: 1, max: 31 }}
                sx={{ width: 120 }}
              />
            </Box>

            <Box sx={{ 
              display: 'flex', 
              gap: 2
            }}>
              <CommonDate
                fullWidth
                label="Fecha de inicio"
                value={formData.fechaInicio ? new Date(formData.fechaInicio) : null}
                onChange={(newValue) => handleChange('fechaInicio', newValue?.toISOString().split('T')[0])}
                error={!!errors.fechaInicio}
                helperText={errors.fechaInicio}
              />
              <CommonDate
                fullWidth
                label="Fecha de fin (opcional)"
                value={formData.fechaFin ? new Date(formData.fechaFin) : null}
                onChange={(newValue) => handleChange('fechaFin', newValue?.toISOString().split('T')[0])}
                minDate={formData.fechaInicio ? new Date(formData.fechaInicio) : null}
              />
            </Box>
          </Paper>

          {/* Propiedad (opcional) */}
          {relatedData?.propiedades?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Autocomplete
                value={selectedPropiedad}
                onChange={(_, newValue) => {
                  setSelectedPropiedad(newValue);
                  handleChange('propiedad', newValue?._id || newValue?.id || '');
                }}
                options={relatedData.propiedades}
                getOptionLabel={(option) => option?.titulo || ''}
                renderInput={(params) => (
                  <StyledTextField
                    {...params}
                    label="Propiedad (opcional)"
                  />
                )}
              />
            </Box>
          )}
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

export default TransaccionRecurrenteForm; 