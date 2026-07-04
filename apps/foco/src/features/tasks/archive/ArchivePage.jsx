import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Chip,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { TareasTable } from '../list';
import { buildTareaPayload } from '../form';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useScopedPageHistory } from '@shared/hooks';
import { useValuesVisibility } from '@shared/context';
import { useObjetivosLight } from '../hooks/useObjetivosLight';
import {
  fetchCompletedTasks,
} from '../api/tasksApi';

export default function ArchivePage() {
  const [tareas, setTareas] = useState([]);
  const { objetivos, refetch: refetchObjetivos } = useObjetivosLight();
  const [selectedTareas, setSelectedTareas] = useState([]);
  const { enqueueSnackbar } = useSnackbar();
  const { isMobile } = useResponsive();
  const { showValues } = useValuesVisibility();
  const navigate = useNavigate();

  const fetchTareas = useCallback(async () => {
    try {
      const data = await fetchCompletedTasks({ limit: 500 });
      setTareas(data.docs || []);
    } catch (error) {
      console.error('Error:', error);
      enqueueSnackbar('Error al cargar tareas', { variant: 'error' });
      setTareas([]);
    }
  }, [enqueueSnackbar]);

  const {
    updateWithHistory,
    deleteWithHistory,
  } = useScopedPageHistory(
    async () => {
      await refetchObjetivos();
      await fetchTareas();
    },
    (error) => {
      console.error('Error al revertir acción:', error);
      enqueueSnackbar('Error al revertir la acción', { variant: 'error' });
    },
    { scope: 'archivo' },
  );

  const handleDeactivateMultiSelect = useCallback(() => {
    setSelectedTareas([]);
    window.dispatchEvent(new CustomEvent('selectionChanged', {
      detail: { hasSelections: false },
    }));
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedTareas.length === 0) return;

    try {
      await Promise.all(selectedTareas.map((id) => deleteWithHistory(id)));
      enqueueSnackbar(`${selectedTareas.length} tarea(s) eliminada(s) exitosamente`, { variant: 'success' });
      setSelectedTareas([]);
      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { hasSelections: false },
      }));
      await fetchTareas();
    } catch (error) {
      console.error('Error al eliminar tareas:', error);
      enqueueSnackbar('Error al eliminar las tareas', { variant: 'error' });
    }
  }, [selectedTareas, enqueueSnackbar, fetchTareas, deleteWithHistory]);

  useEffect(() => {
    fetchTareas();
  }, [fetchTareas]);

  useEffect(() => {
    const handleaddObjetivo = () => navigate('/objetivos');
    const handleAddTask = () => navigate('/tareas');
    const handleDeleteSelectedTasks = () => handleDeleteSelected();

    window.addEventListener('addObjetivo', handleaddObjetivo);
    window.addEventListener('addTask', handleAddTask);
    window.addEventListener('deleteSelectedTasks', handleDeleteSelectedTasks);

    return () => {
      window.removeEventListener('addObjetivo', handleaddObjetivo);
      window.removeEventListener('addTask', handleAddTask);
      window.removeEventListener('deleteSelectedTasks', handleDeleteSelectedTasks);
    };
  }, [navigate, handleDeleteSelected]);

  const handleFormSubmit = useCallback(async (formData, tarea) => {
    if (!tarea) return;

    try {
      const datosAEnviar = buildTareaPayload(formData, { editingTarea: tarea, objetivos });
      await updateWithHistory(tarea._id, datosAEnviar, tarea);
      enqueueSnackbar('Tarea actualizada exitosamente', { variant: 'success' });
      await refetchObjetivos();
      await fetchTareas();
    } catch (error) {
      console.error('Error completo:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Error al guardar la tarea',
        { variant: 'error' },
      );
    }
  }, [objetivos, updateWithHistory, enqueueSnackbar, refetchObjetivos, fetchTareas]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteWithHistory(id);
      enqueueSnackbar('Tarea eliminada exitosamente', { variant: 'success' });
      await fetchTareas();
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
      enqueueSnackbar('Error al eliminar la tarea', { variant: 'error' });
    }
  }, [deleteWithHistory, enqueueSnackbar, fetchTareas]);

  const handleUpdateEstado = (tareaActualizada) => {
    setTareas((prevTareas) =>
      prevTareas.map((tarea) =>
        (tarea._id === tareaActualizada._id ? tareaActualizada : tarea),
      ),
    );
  };

  const handleSelectTarea = (tareaId) => {
    setSelectedTareas((prev) => {
      const newSelection = prev.includes(tareaId)
        ? prev.filter((id) => id !== tareaId)
        : [...prev, tareaId];

      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { hasSelections: newSelection.length > 0 },
      }));

      return newSelection;
    });
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
      <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            py: isMobile ? 1 : 2,
            px: isMobile ? 0 : 1,
            height: isMobile ? 'calc(100vh - 180px)' : 'calc(100vh - 190px)',
            overflowY: 'auto',
            pb: isMobile ? 4 : 6,
            '&::-webkit-scrollbar': {
              width: isMobile ? '4px' : '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0,0,0,0.1)',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(0,0,0,0.3)',
            },
          }}
        >
          <TareasTable
            tareas={tareas}
            onSubmit={handleFormSubmit}
            onObjetivosUpdate={refetchObjetivos}
            onDelete={handleDelete}
            onUpdateEstado={handleUpdateEstado}
            isArchive
            showValues={showValues}
            updateWithHistory={updateWithHistory}
            isMultiSelectMode={selectedTareas.length > 0}
            selectedTareas={selectedTareas}
            onSelectTarea={handleSelectTarea}
            onActivateMultiSelect={() => {}}
            objetivos={objetivos}
          />
        </Box>

        {selectedTareas.length > 0 && (
          <Box
            sx={{
              position: 'fixed',
              bottom: isMobile ? 100 : 20,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: isMobile ? 3 : 2,
              px: isMobile ? 3 : 2,
              py: isMobile ? 1.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 2 : 1,
              boxShadow: 3,
              zIndex: 1000,
              minWidth: isMobile ? 250 : 200,
              justifyContent: 'center',
            }}
          >
            <Chip
              label={`${selectedTareas.length} seleccionadas`}
              size={isMobile ? 'medium' : 'small'}
              color="primary"
              variant="outlined"
            />

            <IconButton
              size={isMobile ? 'medium' : 'small'}
              onClick={handleDeactivateMultiSelect}
              sx={{ color: 'text.secondary' }}
            >
              ✕
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
}
