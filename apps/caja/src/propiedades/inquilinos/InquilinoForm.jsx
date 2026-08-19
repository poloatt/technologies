import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Fade,
  Alert,
  Autocomplete
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { getDocumentId, getPropiedadDisplayLabel } from '../habitacionConstants';

const InquilinoForm = ({
  open,
  onClose,
  onSubmit,
  initialData = null,
  propiedades = []
}) => {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    dni: '',
    propiedad: '',
    nacionalidad: '',
    ocupacion: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [selectedPropiedad, setSelectedPropiedad] = useState(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nombre: initialData.nombre || '',
        apellido: initialData.apellido || '',
        email: initialData.email || '',
        telefono: initialData.telefono || '',
        dni: initialData.dni || '',
        propiedad: initialData.propiedad?._id || initialData.propiedad || '',
        nacionalidad: initialData.nacionalidad || '',
        ocupacion: initialData.ocupacion || ''
      });
      
      if (initialData.propiedad) {
        const propId = getDocumentId(initialData.propiedad);
        const prop = propiedades.find((p) => getDocumentId(p) === propId);
        setSelectedPropiedad(prop || null);
      }
      
      setServerError(null);
    }
  }, [initialData, propiedades]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setServerError(null);

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error al guardar inquilino:', error);
      if (error.response?.data?.details) {
        setErrors(error.response.data.details);
      } else {
        setServerError(error.response?.data?.error || 'Error al guardar inquilino');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePropiedadChange = (event, newValue) => {
    setSelectedPropiedad(newValue);
    setFormData(prev => ({
      ...prev,
      propiedad: getDocumentId(newValue)
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={!isLoading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="h6">
            {initialData ? 'Editar Inquilino' : 'Nuevo Inquilino'}
          </Typography>
          <IconButton
            onClick={onClose}
            disabled={isLoading}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Estado informativo si existe */}
        {initialData && (initialData.estadoLabel || initialData.estadoDescripcion) && (
          <Box sx={{ px: 3, pt: 1, pb: 0 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 4px',
                fontSize: '0.75rem',
                color: '#2196f3',
                height: '20px',
                mb: 0.5
              }}
            >
              {/* Icono según estado si lo deseas, aquí solo color info */}
              {initialData.estadoLabel}
            </Box>
            {initialData.estadoDescripcion && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0, mb: 0.5 }}>
                {initialData.estadoDescripcion}
              </Typography>
            )}
          </Box>
        )}

        <DialogContent>
          {isLoading && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <LinearProgress />
            </Box>
          )}

          {serverError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {serverError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="nombre"
                label="Nombre"
                value={formData.nombre}
                onChange={handleChange}
                error={!!errors.nombre}
                helperText={errors.nombre}
                disabled={isLoading}
                fullWidth
                required
              />
              <TextField
                name="apellido"
                label="Apellido"
                value={formData.apellido}
                onChange={handleChange}
                error={!!errors.apellido}
                helperText={errors.apellido}
                disabled={isLoading}
                fullWidth
                required
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isLoading}
                fullWidth
                required
              />
              <TextField
                name="telefono"
                label="Teléfono"
                value={formData.telefono}
                onChange={handleChange}
                error={!!errors.telefono}
                helperText={errors.telefono}
                disabled={isLoading}
                fullWidth
                required
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="dni"
                label="DNI"
                value={formData.dni}
                onChange={handleChange}
                error={!!errors.dni}
                helperText={errors.dni}
                disabled={isLoading}
                fullWidth
                required
              />
              <TextField
                name="nacionalidad"
                label="Nacionalidad"
                value={formData.nacionalidad}
                onChange={handleChange}
                error={!!errors.nacionalidad}
                helperText={errors.nacionalidad}
                disabled={isLoading}
                fullWidth
                required
              />
            </Box>

            <TextField
              name="ocupacion"
              label="Ocupación"
              value={formData.ocupacion}
              onChange={handleChange}
              error={!!errors.ocupacion}
              helperText={errors.ocupacion}
              disabled={isLoading}
              fullWidth
            />

            <Autocomplete
              value={selectedPropiedad}
              onChange={handlePropiedadChange}
              options={propiedades}
              getOptionLabel={(option) => getPropiedadDisplayLabel(option)}
              isOptionEqualToValue={(option, value) => getDocumentId(option) === getDocumentId(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Propiedad"
                  error={!!errors.propiedad}
                  helperText={errors.propiedad}
                  disabled={isLoading}
                />
              )}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default InquilinoForm; 
