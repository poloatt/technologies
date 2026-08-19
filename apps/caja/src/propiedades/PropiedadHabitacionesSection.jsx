import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { CommonForm } from '@shared/components/common';
import { snackbar } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import HabitacionesForm from './HabitacionesForm';
import HabitacionesCarouselSection from './HabitacionesCarouselSection';
import {
  HABITACION_TIPO_OPTIONS,
  buildHabitacionPayload,
  getHabitacionTipoLabel,
  normalizePropiedadForSelect,
} from './habitacionConstants';
import { getHabitacionTipoMuiIcon } from './getHabitacionTipoMuiIcon';

const editFormFields = [
  {
    name: 'tipo',
    label: 'Tipo de ambiente',
    type: 'select',
    required: true,
    options: HABITACION_TIPO_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      icon: getHabitacionTipoMuiIcon(opt.value),
    })),
  },
  {
    name: 'nombrePersonalizado',
    label: 'Especificar tipo',
    type: 'text',
    placeholder: 'Ej: Sala de juegos, Gimnasio…',
    hidden: (formData) => formData.tipo !== 'OTRO',
    validate: (value, formData) => {
      if (formData.tipo === 'OTRO' && (!value || !value.trim())) {
        return 'Debes especificar el tipo';
      }
      return '';
    },
  },
];

/**
 * CRUD de ambientes dentro del detalle de una propiedad.
 */
export default function PropiedadHabitacionesSection({
  propiedadId,
  habitaciones = [],
  inventarios = [],
  propiedades = [],
  onChanged,
  initialHabitacionId = null,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingHabitacion, setEditingHabitacion] = useState(null);
  const habitacionFocusApplied = useRef(false);

  const propiedadNorm = normalizePropiedadForSelect(
    propiedades.find((p) => String(p.id || p._id) === String(propiedadId)) || {
      _id: propiedadId,
      id: propiedadId,
    },
  );

  const refreshParent = useCallback(() => {
    onChanged?.();
    window.dispatchEvent(
      new CustomEvent('entityUpdated', { detail: { type: 'propiedades' } }),
    );
  }, [onChanged]);

  const handleMultipleSubmit = async (habitacionesData) => {
    try {
      await Promise.all(
        habitacionesData.map((data) => clienteAxios.post('/api/habitaciones', data)),
      );
      snackbar.success('Ambientes agregados');
      setAddOpen(false);
      refreshParent();
    } catch (error) {
      console.error('Error al crear habitaciones:', error);
      snackbar.error(error.response?.data?.error || 'Error al guardar ambientes');
      throw error;
    }
  };

  const handleEditSubmit = async (formData) => {
    const habitacionId = editingHabitacion?.id || editingHabitacion?._id;
    if (!habitacionId) return;

    try {
      const payload = buildHabitacionPayload({
        propiedadId: String(propiedadId),
        tipo: formData.tipo,
        nombrePersonalizado: formData.nombrePersonalizado,
      });
      await clienteAxios.put(`/api/habitaciones/${habitacionId}`, payload);
      snackbar.success('Ambiente actualizado');
      setEditOpen(false);
      setEditingHabitacion(null);
      refreshParent();
    } catch (error) {
      console.error('Error al editar habitación:', error);
      snackbar.error(error.response?.data?.error || 'Error al guardar');
      throw error;
    }
  };

  const handleDelete = async (habitacion) => {
    const id = habitacion.id || habitacion._id;
    try {
      await clienteAxios.delete(`/api/habitaciones/${id}`);
      snackbar.success('Ambiente eliminado');
      refreshParent();
    } catch (error) {
      console.error('Error al eliminar habitación:', error);
      snackbar.error('Error al eliminar el ambiente');
    }
  };

  const handleEdit = useCallback((habitacion) => {
    setEditingHabitacion({
      ...habitacion,
      id: habitacion.id || habitacion._id,
      tipo: habitacion.tipo,
      nombrePersonalizado: habitacion.nombrePersonalizado || '',
    });
    setEditOpen(true);
  }, []);

  useEffect(() => {
    habitacionFocusApplied.current = false;
  }, [initialHabitacionId, propiedadId]);

  useEffect(() => {
    if (!initialHabitacionId || habitacionFocusApplied.current || !habitaciones.length) return;
    const target = habitaciones.find(
      (h) => String(h.id || h._id) === String(initialHabitacionId),
    );
    if (target) {
      habitacionFocusApplied.current = true;
      handleEdit(target);
    }
  }, [initialHabitacionId, habitaciones, handleEdit]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          size="small"
          variant="text"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{
            textTransform: 'none',
            borderRadius: '20px',
            color: 'text.secondary',
            fontSize: '0.8125rem',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Agregar ambientes
        </Button>
      </Box>

      <HabitacionesCarouselSection
        habitaciones={habitaciones}
        inventarios={inventarios}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Sin ambientes registrados"
      />

      <HabitacionesForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleMultipleSubmit}
        propiedades={propiedadNorm ? [propiedadNorm] : []}
        initialPropiedadId={propiedadId}
        lockPropiedad
      />

      <CommonForm
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingHabitacion(null);
        }}
        onSubmit={handleEditSubmit}
        title={`Editar ${getHabitacionTipoLabel(
          editingHabitacion?.tipo,
          editingHabitacion?.nombrePersonalizado,
        )}`}
        fields={editFormFields}
        initialData={editingHabitacion || {}}
        isEditing
      />
    </Box>
  );
}
