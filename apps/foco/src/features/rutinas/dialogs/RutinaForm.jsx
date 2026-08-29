import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  Typography,
  Box,
  Grid,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import clienteAxios from '@shared/config/axios';
import { snackbar } from '@shared/components/common';
import { CommonDate } from '@shared/components/common';
import { formatDateForAPI, getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';
import { useRutinas } from '@shared/context';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
  TareaFormFooter,
} from '@shared/components/forms/tareaFormUi';

export const RutinaForm = ({ open = true, onClose, initialData, isEditing }) => {
  const { isMobile } = useResponsive();
  const fullScreen = isMobile;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { getRutinaById } = useRutinas();

  const [formData, setFormData] = useState(() => {
    let initialDate;
    if (initialData?.fecha) {
      const parsed = parseAPIDate(initialData.fecha);
      initialDate = formatDateForAPI(parsed);
    } else {
      initialDate = formatDateForAPI(getNormalizedToday());
    }
    return {
      fecha: initialDate,
      useGlobalConfig: true,
    };
  });

  useEffect(() => {
    if (initialData) {
      const parsedDate = parseAPIDate(initialData.fecha);
      setFormData((prev) => ({
        ...prev,
        fecha: parsedDate ? formatDateForAPI(parsedDate) : formatDateForAPI(getNormalizedToday()),
      }));
    }
  }, [initialData]);

  const handleDateChange = (newDate) => {
    if (!newDate || isNaN(newDate.getTime())) return;
    const fechaString = formatDateForAPI(newDate);
    setFormData((prev) => ({
      ...prev,
      fecha: fechaString,
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (isSubmitting) return;

    if (!formData.fecha) {
      snackbar.error('Por favor selecciona una fecha');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && initialData?._id) {
        await clienteAxios.put(`/api/rutinas/${initialData._id}`, { fecha: formData.fecha });
        snackbar.success('Rutina actualizada con éxito');
        onClose();
      } else {
        const response = await clienteAxios.post('/api/rutinas', {
          fecha: formData.fecha,
          useGlobalConfig: true,
        });
        const createdRutina = response.data;

        if (createdRutina?._id) {
          snackbar.success('Rutina creada con éxito');
          onClose();
          navigate('/rutinas');
        }
      }
    } catch (submitError) {
      let errorMsg = 'Error al guardar la rutina';

      if (submitError.response?.status === 409) {
        const existingId = submitError.response?.data?.rutinaId;
        if (existingId) {
          try {
            await getRutinaById(existingId);
          } catch {
            // noop
          }
          onClose();
          navigate('/rutinas');
          return;
        }
        errorMsg = 'Ya existe una rutina para esta fecha';
      } else if (submitError.response?.data?.error) {
        errorMsg = submitError.response.data.error;
      }

      setError(errorMsg);
      snackbar.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose || (() => {})}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        },
      }}
    >
      <TareaFormHeader onClose={onClose}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
          {isEditing ? 'Editar Rutina' : 'Nueva Rutina'}
        </Typography>
      </TareaFormHeader>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.5, sm: 2 },
          bgcolor: 'background.paper',
        }}
      >
        {error ? (
          <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
            {error}
          </Typography>
        ) : null}
        <Grid container spacing={0}>
          <Grid item xs={12}>
            <CommonDate
              label="Selecciona una fecha"
              value={formData.fecha}
              onChange={handleDateChange}
              embedded
            />
          </Grid>
        </Grid>
      </Box>

      <TareaFormFooter
        onCancel={onClose}
        cancelLabel="Cancelar"
        showCancel
        onSave={handleSubmit}
        saving={isSubmitting}
        saveLabel={isEditing ? 'Guardar cambios' : 'Crear rutina'}
      />
    </Dialog>
  );
};
