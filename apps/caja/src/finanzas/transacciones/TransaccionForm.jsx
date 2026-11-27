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
import { CATEGORIAS } from './categoriasConstants';
import { TransaccionRecurrenteForm } from '../recurrente';
import clienteAxios from '@shared/config/axios';
import { getEstadoColor } from '@shared/components/common/StatusSystem';
import { alpha } from '@mui/material/styles';
import { getMonedasFromCuenta, isCuentaMultimoneda } from '../cuentas/cuentaConstants';
import { FONT_SIZE } from '@shared/tipografia';

const AR_TZ = 'America/Argentina/Buenos_Aires';
const MONTO_MAX = 1_000_000_000_000;

/** YYYY-MM-DD del día en Argentina (el backend interpreta las fechas en esa zona). */
const arDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return arDateKey(new Date());
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/** El backend guarda COMPLETADA; el form habla PAGADO. */
const toFormEstado = (estado) => {
  if (estado === 'PENDIENTE') return 'PENDIENTE';
  if (estado === 'CANCELADA' || estado === 'CANCELADO') return 'CANCELADA';
  return 'PAGADO';
};

const getId = (value) => (
  typeof value === 'string' ? value : (value?._id || value?.id || '')
);

const isCuentaDisponibleParaAlta = (cuenta) => (
  cuenta?.tipo !== 'MERCADO_PAGO' && cuenta?.activo !== false
);

const buildInitialFormData = (initialData = {}) => ({
  tipo: initialData.tipo || 'INGRESO',
  estado: toFormEstado(initialData.estado || 'PAGADO'),
  monto: initialData.monto != null && initialData.monto !== '' ? String(initialData.monto) : '',
  descripcion: initialData.descripcion || '',
  categoria: initialData.categoria || '',
  fecha: initialData.fecha ? arDateKey(initialData.fecha) : arDateKey(),
  cuenta: '',
  moneda: '',
  contacto: getId(initialData.contacto) || ''
});

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
      if (props.value === 'EGRESO') return alpha(theme.palette.error.main, 0.15);
      const estadoColor = getEstadoColorForToggle(props.value);
      if (estadoColor) return alpha(estadoColor, 0.15);
      return 'inherit';
    },
    color: props => {
      if (props.value === 'INGRESO') return '#5a9b5f';
      if (props.value === 'EGRESO') return theme.palette.error.main;
      const estadoColor = getEstadoColorForToggle(props.value);
      if (estadoColor) return estadoColor;
      return 'inherit';
    },
    '&:hover': {
      backgroundColor: props => {
        if (props.value === 'INGRESO') return 'rgba(90, 155, 95, 0.25)';
        if (props.value === 'EGRESO') return alpha(theme.palette.error.main, 0.25);
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

const RELATED_FIELDS = [
  {
    type: 'relational',
    name: 'cuenta',
    endpoint: '/cuentas',
    labelField: 'nombre',
    populate: ['moneda']
  },
  {
    type: 'relational',
    name: 'contacto',
    endpoint: '/contactos',
    labelField: 'nombre'
  }
];

const TransaccionForm = ({
  open,
  onClose,
  onSubmit,
  initialData = {},
  isEditing = false,
  /** Bloquea el selector de cuenta (alta desde el detalle de una cuenta). */
  lockCuenta = false,
}) => {
  const [formData, setFormData] = useState(() => buildInitialFormData(initialData));
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const { relatedData, isLoading: isLoadingRelated } = useRelationalData({
    open,
    relatedFields: RELATED_FIELDS
  });

  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [isRecurrente, setIsRecurrente] = useState(false);

  const initialCuentaId = getId(initialData.cuenta);
  const initialMonedaId = getId(initialData.moneda);

  // Mercado Pago solo se actualiza por sync/CSV y las cuentas inactivas no reciben altas.
  // La cuenta seleccionada (por ejemplo al editar un registro viejo) siempre se conserva.
  const cuentaOptions = useMemo(() => {
    const todas = relatedData?.cuenta || [];
    const selectedId = getId(selectedCuenta);
    return todas.filter((cuenta) => (
      isCuentaDisponibleParaAlta(cuenta) || getId(cuenta) === selectedId
    ));
  }, [relatedData?.cuenta, selectedCuenta]);

  const isSelectedMultimoneda = isCuentaMultimoneda(selectedCuenta);
  const monedasCuenta = useMemo(
    () => (isSelectedMultimoneda ? getMonedasFromCuenta(selectedCuenta) : []),
    [isSelectedMultimoneda, selectedCuenta],
  );
  const monedaSeleccionada = useMemo(() => {
    if (isSelectedMultimoneda) {
      return (
        monedasCuenta.find((m) => m.id === String(formData.moneda))
        || monedasCuenta[0]
        || null
      );
    }
    return selectedCuenta?.moneda || null;
  }, [isSelectedMultimoneda, monedasCuenta, formData.moneda, selectedCuenta]);

  const categoriasDisponibles = useMemo(
    () => CATEGORIAS.filter((categoria) => categoria.tipos.includes(formData.tipo)),
    [formData.tipo],
  );

  // Efecto para reiniciar el formulario cuando se abre
  useEffect(() => {
    if (open) {
      setFormData(buildInitialFormData(initialData));
      setSelectedCuenta(null);
      setErrors({});
      setIsRecurrente(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Efecto para manejar la cuenta cuando los datos relacionales están disponibles
  useEffect(() => {
    if (!open || isLoadingRelated) return;
    if (!relatedData?.cuenta?.length || !initialCuentaId) return;

    const cuentaEncontrada = relatedData.cuenta.find((c) => getId(c) === initialCuentaId);
    if (!cuentaEncontrada) return;
    // Una cuenta Mercado Pago no admite altas nuevas; solo se conserva al editar.
    if (!isEditing && !isCuentaDisponibleParaAlta(cuentaEncontrada)) return;

    setSelectedCuenta(cuentaEncontrada);
    const multimoneda = isCuentaMultimoneda(cuentaEncontrada);
    const monedasDisponibles = multimoneda ? getMonedasFromCuenta(cuentaEncontrada) : [];
    const monedaCuentaId = getId(cuentaEncontrada.moneda);
    const resolvedMonedaId = multimoneda
      ? (
          monedasDisponibles.find((m) => m.id === String(initialMonedaId))?.id
          || monedasDisponibles[0]?.id
          || monedaCuentaId
        )
      : monedaCuentaId;
    setFormData((prev) => ({
      ...prev,
      cuenta: getId(cuentaEncontrada),
      moneda: resolvedMonedaId || ''
    }));
  }, [relatedData?.cuenta, initialCuentaId, initialMonedaId, open, isLoadingRelated, isEditing]);

  const handleChange = useCallback((name, value) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // La categoría debe existir para el tipo elegido (ingreso/egreso).
      if (name === 'tipo' && prev.categoria) {
        const categoria = CATEGORIAS.find((c) => c.valor === prev.categoria);
        if (categoria && !categoria.tipos.includes(value)) next.categoria = '';
      }
      return next;
    });
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev));
  }, []);

  const handleMontoChange = (event) => {
    const value = event.target.value.replace(',', '.');
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      handleChange('monto', value);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const monto = Number(formData.monto);
    if (!formData.tipo) newErrors.tipo = 'Seleccione el tipo';
    if (!formData.monto) newErrors.monto = 'Ingrese el monto';
    else if (!Number.isFinite(monto) || monto <= 0) newErrors.monto = 'El monto debe ser mayor a cero';
    else if (monto > MONTO_MAX) newErrors.monto = 'El monto es demasiado grande';
    if (!formData.descripcion?.trim()) newErrors.descripcion = 'Ingrese una descripción';
    if (!formData.categoria) newErrors.categoria = 'Seleccione una categoría';
    if (!formData.fecha || Number.isNaN(new Date(`${formData.fecha}T12:00:00`).getTime())) {
      newErrors.fecha = 'Ingrese una fecha válida';
    }
    if (!selectedCuenta) newErrors.cuenta = 'Seleccione una cuenta';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (isSaving || !validateForm()) return;

    setIsSaving(true);
    try {
      const resolvedMoneda = formData.moneda
        || monedaSeleccionada?.id
        || monedaSeleccionada?._id
        || getId(selectedCuenta?.moneda)
        || '';
      const dataToSubmit = {
        ...formData,
        descripcion: formData.descripcion.trim(),
        monto: parseFloat(formData.monto),
        estado: formData.estado || 'PAGADO',
        cuenta: getId(selectedCuenta) || formData.cuenta,
        contacto: formData.contacto || null,
        ...(resolvedMoneda ? { moneda: resolvedMoneda } : {}),
      };

      // Los handlers de las páginas deben propagar el error para que el form no se cierre.
      await onSubmit(dataToSubmit);
      enqueueSnackbar(
        isEditing ? 'Transacción actualizada' : 'Transacción guardada',
        { variant: 'success' }
      );
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      const data = error.response?.data;
      const detalle = Array.isArray(data?.errors) ? data.errors.join(', ') : null;
      enqueueSnackbar(
        detalle || data?.message || data?.error || error.message || 'Error al guardar',
        { variant: 'error' }
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecurrenteToggle = () => {
    setIsRecurrente((prev) => !prev);
  };

  // Solo altas: editar una transacción nunca edita su regla recurrente.
  const handleRecurrenteSubmit = async (recurrenteData) => {
    try {
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

      await clienteAxios.post('/api/transaccionesrecurrentes', datosAEnviar);

      enqueueSnackbar('Transacción recurrente guardada', { variant: 'success' });
      onClose();
    } catch (error) {
      console.error('Error al guardar transacción recurrente:', error);
      enqueueSnackbar(
        error.response?.data?.message || error.message || 'Error al guardar',
        { variant: 'error' }
      );
    }
  };

  if (isRecurrente && !isEditing) {
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
          cuenta: getId(selectedCuenta) || formData.cuenta,
          fechaInicio: formData.fecha,
          diaDelMes: String(Number(formData.fecha.slice(8, 10)) || new Date().getDate())
        }}
        relatedData={{
          cuentas: cuentaOptions,
          propiedades: []
        }}
        isEditing={false}
        onSwitchToSimple={(data) => {
          setIsRecurrente(false);
          setFormData((prev) => ({
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
                startAdornment: monedaSeleccionada?.simbolo && (
                  <InputAdornment position="start">
                    <Box
                      component="span"
                      sx={{
                        color: monedaSeleccionada.color || 'inherit',
                        fontWeight: 600,
                      }}
                    >
                      {monedaSeleccionada.simbolo}
                    </Box>
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
              {formData.estado === 'CANCELADA' && (
                <ToggleButton value="CANCELADA">
                  <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    Cancelada
                  </Typography>
                </ToggleButton>
              )}
            </ToggleButtonGroup>
          </Box>

          {/* Descripción y Fecha */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <StyledTextField
              fullWidth
              label="Descripción"
              value={formData.descripcion || ''}
              onChange={(e) => handleChange('descripcion', e.target.value)}
              error={!!errors.descripcion}
              helperText={errors.descripcion}
              InputLabelProps={{
                shrink: true
              }}
            />
            <StyledTextField
              type="date"
              label="Fecha"
              value={formData.fecha || ''}
              onChange={(e) => handleChange('fecha', e.target.value)}
              error={!!errors.fecha}
              helperText={errors.fecha}
              sx={{ minWidth: { sm: 170 } }}
              InputLabelProps={{
                shrink: true
              }}
            />
          </Box>

          {/* Cuenta */}
          <Autocomplete
            key={`cuenta-${open}-${selectedCuenta?.id || 'new'}`}
            value={selectedCuenta}
            disabled={lockCuenta}
            onChange={(event, newValue) => {
              setSelectedCuenta(newValue);
              setErrors((prev) => (prev.cuenta ? { ...prev, cuenta: null } : prev));
              if (newValue) {
                const monedasOpciones = isCuentaMultimoneda(newValue)
                  ? getMonedasFromCuenta(newValue)
                  : [];
                const nextMonedaId = isCuentaMultimoneda(newValue)
                  ? (monedasOpciones[0]?.id || newValue.moneda?._id || newValue.moneda?.id || newValue.moneda || '')
                  : (newValue.moneda?._id || newValue.moneda?.id || newValue.moneda || '');
                setFormData(prev => ({
                  ...prev,
                  cuenta: newValue._id || newValue.id,
                  moneda: nextMonedaId
                }));
              } else {
                setFormData(prev => ({
                  ...prev,
                  cuenta: '',
                  moneda: ''
                }));
              }
            }}
            options={cuentaOptions}
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
                      {isCuentaMultimoneda(option)
                        ? `${getMonedasFromCuenta(option).map((m) => m.simbolo).join(' · ') || 'Multimoneda'} - ${option.tipo}`
                        : `${option.moneda?.simbolo || '$'} - ${option.tipo}`}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
          />

          {/* Selector de Moneda para cuentas multimoneda (p. ej. Efectivo) */}
          {isSelectedMultimoneda && monedasCuenta.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Moneda
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {monedasCuenta.map((moneda) => {
                  const selected = String(formData.moneda) === moneda.id;
                  return (
                    <Box
                      key={moneda.id}
                      component="button"
                      type="button"
                      onClick={() => handleChange('moneda', moneda.id)}
                      aria-pressed={selected}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.25,
                        py: 0.625,
                        border: '1px solid',
                        borderColor: selected ? moneda.color : 'divider',
                        bgcolor: selected ? alpha(moneda.color || '#75AADB', 0.14) : 'background.paper',
                        color: selected ? moneda.color : 'text.primary',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontSize: FONT_SIZE.md,
                        fontWeight: selected ? 700 : 500,
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: moneda.color || '#75AADB',
                          flexShrink: 0,
                        }}
                      />
                      <span>{moneda.simbolo}</span>
                      <span>{moneda.codigo}</span>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Selector opcional de Contacto */}
          {(relatedData?.contacto?.length > 0 || formData.contacto) && (
            <Autocomplete
              options={relatedData?.contacto || []}
              value={
                (relatedData?.contacto || []).find((c) => getId(c) === formData.contacto) || null
              }
              onChange={(_, newValue) => {
                const nextId = getId(newValue);
                setFormData((prev) => {
                  const next = { ...prev, contacto: nextId };
                  if (newValue && !prev.categoria) {
                    const suggested =
                      (prev.tipo === 'INGRESO'
                        ? newValue.categoriaIngreso
                        : newValue.categoriaEgreso) || newValue.categoriaDefault;
                    const valid = suggested && CATEGORIAS.some(
                      (c) => c.valor === suggested && c.tipos.includes(prev.tipo)
                    );
                    if (valid) next.categoria = suggested;
                  }
                  return next;
                });
              }}
              getOptionLabel={(option) => option?.nombre || ''}
              isOptionEqualToValue={(option, value) => getId(option) === getId(value)}
              renderInput={(params) => (
                <StyledTextField
                  {...params}
                  label="Contacto (opcional)"
                  placeholder="Sin contacto"
                  sx={{ mt: 2 }}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={key || getId(option)} {...otherProps}>
                    <Box>
                      <Typography variant="subtitle2">{option.nombre}</Typography>
                      {option.categoriaDefault && (
                        <Typography variant="caption" color="text.secondary">
                          {option.categoriaDefault}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }}
            />
          )}

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
              {errors.categoria && (
                <Typography variant="caption" color="error">
                  {errors.categoria}
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
              {categoriasDisponibles.map((categoria) => {
                const CatIcon = categoria.Icon;
                return (
                <CategoryChip
                  key={categoria.valor}
                  icon={<CatIcon sx={{ fontSize: 18 }} />}
                  title={categoria.valor}
                  aria-label={categoria.valor}
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
                );
              })}
            </Box>
          </Box>

          {/* Switch Recurrente: solo al crear (editar no modifica reglas recurrentes) */}
          {!isEditing && (
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

export default TransaccionForm; 