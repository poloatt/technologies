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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Alert,
  Checkbox,
  OutlinedInput,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  HABITACION_TIPO_OPTIONS,
  buildHabitacionPayload,
  getHabitacionTipoLabel,
  normalizePropiedadesList,
} from './habitacionConstants';
import { getHabitacionTipoMuiIcon } from './getHabitacionTipoMuiIcon';

const DialogHeader = ({ title, onClose, isLoading }) => (
  <Box sx={{ position: 'relative' }}>
    <DialogTitle sx={{ px: 3, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ color: isLoading ? 'text.secondary' : 'text.primary' }}>
          {title}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary', borderRadius: 0 }}
          disabled={isLoading}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </DialogTitle>
    <Fade in={isLoading}>
      <LinearProgress sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }} />
    </Fade>
  </Box>
);

function HabitacionItem({ habitacion, onDelete, index }) {
  return (
    <ListItem
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        mb: 1,
        borderRadius: 0,
        bgcolor: 'background.paper',
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        {getHabitacionTipoMuiIcon(habitacion.tipo)}
      </ListItemIcon>
      <ListItemText
        primary={getHabitacionTipoLabel(habitacion.tipo, habitacion.nombrePersonalizado)}
        secondary={`Habitación ${index + 1}`}
      />
      <ListItemSecondaryAction>
        <IconButton edge="end" onClick={() => onDelete(index)} sx={{ borderRadius: 0 }}>
          <DeleteIcon />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

const HabitacionesForm = ({
  open,
  onClose,
  onSubmit,
  propiedades = [],
  initialPropiedadId = null,
  /** Si true, oculta el selector de propiedad (contexto: detalle de propiedad). */
  lockPropiedad = false,
}) => {
  const propiedadesNorm = useMemo(() => normalizePropiedadesList(propiedades), [propiedades]);
  const [propiedadId, setPropiedadId] = useState('');
  const [selectedTipos, setSelectedTipos] = useState([]);
  const [nombreOtro, setNombreOtro] = useState('');
  const [habitaciones, setHabitaciones] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (!open) return;

    const norm = normalizePropiedadesList(propiedades);
    const initialId = initialPropiedadId ? String(initialPropiedadId) : '';
    const match = norm.find((p) => p.id === initialId);
    setPropiedadId(match?.id || norm[0]?.id || '');
    setSelectedTipos([]);
    setNombreOtro('');
    setHabitaciones([]);
    setErrors({});
  }, [open, initialPropiedadId, propiedades]);

  const handleAddSelectedTipos = useCallback(() => {
    if (selectedTipos.length === 0) {
      setErrors((prev) => ({ ...prev, tipos: 'Selecciona al menos un tipo' }));
      return;
    }

    if (selectedTipos.includes('OTRO') && !nombreOtro.trim()) {
      setErrors((prev) => ({ ...prev, nombreOtro: 'Especifica el tipo personalizado' }));
      return;
    }

    setHabitaciones((prev) => {
      const existing = new Set(prev.map((h) => h.tipo));
      const toAdd = selectedTipos
        .filter((tipo) => !existing.has(tipo))
        .map((tipo) => ({
          tipo,
          icono: buildHabitacionPayload({ propiedadId, tipo }).icono,
          nombrePersonalizado: tipo === 'OTRO' ? nombreOtro.trim() : undefined,
        }));

      if (toAdd.length === 0) {
        enqueueSnackbar('Esos tipos ya están en la lista', { variant: 'info' });
        return prev;
      }

      return [...prev, ...toAdd];
    });

    setSelectedTipos([]);
    setNombreOtro('');
    setErrors({});
  }, [selectedTipos, nombreOtro, propiedadId, enqueueSnackbar]);

  const handleDeleteHabitacion = useCallback((index) => {
    setHabitaciones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!propiedadId) {
      enqueueSnackbar('Debes seleccionar una propiedad', { variant: 'error' });
      return;
    }

    if (habitaciones.length === 0) {
      enqueueSnackbar('Debes agregar al menos una habitación', { variant: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const habitacionesData = habitaciones.map((h) =>
        buildHabitacionPayload({
          propiedadId,
          tipo: h.tipo,
          nombrePersonalizado: h.nombrePersonalizado,
        }),
      );

      await onSubmit(habitacionesData);
      enqueueSnackbar(`${habitaciones.length} habitación(es) agregada(s) exitosamente`, {
        variant: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Error al guardar habitaciones:', error);
      enqueueSnackbar('Error al guardar las habitaciones', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [propiedadId, habitaciones, onSubmit, onClose, enqueueSnackbar]);

  const renderTiposValue = (selected) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {selected.map((tipo) => (
        <Chip
          key={tipo}
          size="small"
          icon={getHabitacionTipoMuiIcon(tipo, { fontSize: 16 })}
          label={getHabitacionTipoLabel(tipo)}
        />
      ))}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={!isSaving ? onClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.default',
          backgroundImage: 'none',
          borderRadius: 0,
        },
      }}
    >
      <DialogHeader title="Agregar habitaciones" onClose={onClose} isLoading={isSaving} />

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {!lockPropiedad && (
            <>
              <FormControl fullWidth size="small" error={!propiedadId && !!errors.propiedad}>
                <InputLabel required>Propiedad</InputLabel>
                <Select
                  value={propiedadId}
                  onChange={(e) => setPropiedadId(String(e.target.value))}
                  label="Propiedad"
                  disabled={isSaving || propiedadesNorm.length === 0}
                >
                  {propiedadesNorm.length === 0 ? (
                    <MenuItem disabled value="">
                      No hay propiedades cargadas
                    </MenuItem>
                  ) : (
                    propiedadesNorm.map((propiedad) => (
                      <MenuItem key={propiedad.id} value={propiedad.id}>
                        {propiedad.label}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {propiedadesNorm.length === 0 && (
                <Alert severity="warning" sx={{ borderRadius: 0 }}>
                  Crea al menos una propiedad antes de agregar habitaciones.
                </Alert>
              )}

              <Divider />
            </>
          )}

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Tipos de habitación (selección múltiple)
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth size="small" error={!!errors.tipos}>
                <InputLabel>Tipos</InputLabel>
                <Select
                  multiple
                  value={selectedTipos}
                  onChange={(e) => {
                    const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                    setSelectedTipos(value);
                    if (errors.tipos) setErrors((prev) => ({ ...prev, tipos: null }));
                  }}
                  input={<OutlinedInput label="Tipos" />}
                  renderValue={renderTiposValue}
                  disabled={isSaving}
                >
                  {HABITACION_TIPO_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Checkbox checked={selectedTipos.includes(option.value)} size="small" />
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {getHabitacionTipoMuiIcon(option.value)}
                      </ListItemIcon>
                      <ListItemText primary={option.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedTipos.includes('OTRO') && (
                <TextField
                  label="Especificar tipo (Otro)"
                  value={nombreOtro}
                  onChange={(e) => {
                    setNombreOtro(e.target.value);
                    if (errors.nombreOtro) setErrors((prev) => ({ ...prev, nombreOtro: null }));
                  }}
                  placeholder="Ej: Sala de juegos, Gimnasio…"
                  size="small"
                  error={!!errors.nombreOtro}
                  helperText={errors.nombreOtro}
                  fullWidth
                />
              )}

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSelectedTipos}
                disabled={isSaving || selectedTipos.length === 0}
                sx={{ borderRadius: 0, alignSelf: 'flex-start' }}
              >
                Agregar seleccionadas
              </Button>
            </Box>
          </Box>

          {habitaciones.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Habitaciones a guardar ({habitaciones.length})
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', borderRadius: 0 }}>
                <List dense>
                  {habitaciones.map((habitacion, index) => (
                    <HabitacionItem
                      key={`${habitacion.tipo}-${index}`}
                      habitacion={habitacion}
                      onDelete={handleDeleteHabitacion}
                      index={index}
                    />
                  ))}
                </List>
              </Paper>
            </Box>
          )}

          {habitaciones.length === 0 && (
            <Alert severity="info" sx={{ borderRadius: 0 }}>
              Elegí uno o más tipos y pulsá «Agregar seleccionadas».
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSaving} sx={{ borderRadius: 0 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSaving || habitaciones.length === 0 || !propiedadId}
          sx={{ borderRadius: 0 }}
        >
          {isSaving ? 'Guardando…' : `Guardar ${habitaciones.length} habitación(es)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HabitacionesForm;
