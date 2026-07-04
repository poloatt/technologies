import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { useValuesVisibility } from '@shared/context';
import { usePageWithHistory, useResponsive } from '@shared/hooks';
import { useAgendaFilter } from '../../agenda/hooks/useAgendaFilter';
import { useObjetivosLight } from '../hooks/useObjetivosLight';
import { useTasksForList } from '../hooks/useTasksForList';
import { isInAhora, isInLuego, isTaskCompleted } from '@shared/utils/agendaRules';
import { useRutinas, useHabits } from '@shared/context';
import { getNormalizedToday } from '@shared/utils/dateUtils';
import { ensureRutinaForDate } from '../../habits/daily/ensureRutinaForDate';
import { buildTareaPayload, syncTareaToGoogleInBackground } from '../form';

/**
 * Estado, handlers y toolbar compartidos de la página Tareas.
 */
export function useTareasPageController() {
  const { fetchRutinas, getRutinaById } = useRutinas();
  const { fetchHabits } = useHabits();
  const { tasks: tareas, setTasks: setTareas, loading, refetch: refetchTareas } = useTasksForList();
  const { objetivos, refetch: refetchObjetivos } = useObjetivosLight();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [isGoogleTasksConfigOpen, setIsGoogleTasksConfigOpen] = useState(false);
  const [selectedTareas, setSelectedTareas] = useState([]);
  const { enqueueSnackbar } = useSnackbar();
  const { isMobile } = useResponsive();
  const { showValues } = useValuesVisibility();

  const { filteredTasks: tareasAgenda, showCompleted, agendaView } = useAgendaFilter(tareas);

  const tareasAhora = useMemo(() => {
    if (isMobile) return [];
    const tasksArray = Array.isArray(tareas) ? tareas : [];
    const now = new Date();
    return tasksArray.filter((t) => {
      const isCompleted = isTaskCompleted(t);
      if (!showCompleted && isCompleted) return false;
      return isInAhora(t, now);
    });
  }, [tareas, showCompleted, isMobile]);

  const tareasLuego = useMemo(() => {
    if (isMobile) return [];
    const tasksArray = Array.isArray(tareas) ? tareas : [];
    const now = new Date();
    return tasksArray.filter((t) => {
      const isCompleted = isTaskCompleted(t);
      if (!showCompleted && isCompleted) return false;
      return isInLuego(t, now);
    });
  }, [tareas, showCompleted, isMobile]);

  useEffect(() => {
    let cancelled = false;

    const bootRutinas = async () => {
      await Promise.all([
        typeof fetchHabits === 'function' ? fetchHabits().catch(() => {}) : Promise.resolve(),
        typeof fetchRutinas === 'function' ? fetchRutinas().catch(() => {}) : Promise.resolve(),
      ]);
      if (cancelled || typeof getRutinaById !== 'function') return;
      await ensureRutinaForDate(getNormalizedToday(), {
        rutinas: [],
        getRutinaById,
        fetchRutinas,
      }).catch(() => {});
    };

    bootRutinas();
    return () => { cancelled = true; };
  }, [fetchRutinas, fetchHabits, getRutinaById]);

  const fetchDataStable = useCallback(async () => {
    try {
      await Promise.all([refetchObjetivos(), refetchTareas()]);
    } catch (error) {
      console.error('Error al recargar datos:', error);
      enqueueSnackbar('Error al recargar datos', { variant: 'error' });
    }
  }, [refetchObjetivos, refetchTareas, enqueueSnackbar]);

  const {
    createWithHistory,
    updateWithHistory,
    deleteWithHistory,
  } = usePageWithHistory(fetchDataStable, (error) => {
    console.error('Error al revertir acción:', error);
    enqueueSnackbar('Error al revertir la acción', { variant: 'error' });
  });

  const openNewTareaForm = useCallback(() => {
    setEditingTarea(null);
    setIsFormOpen(true);
  }, []);

  const handleDeactivateMultiSelect = useCallback(() => {
    setSelectedTareas([]);
    window.dispatchEvent(new CustomEvent('selectionChanged', {
      detail: { hasSelections: false },
    }));
  }, []);

  const handleSelectTarea = useCallback((tareaId) => {
    setSelectedTareas((prev) => {
      const newSelection = prev.includes(tareaId)
        ? prev.filter((id) => id !== tareaId)
        : [...prev, tareaId];

      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { hasSelections: newSelection.length > 0 },
      }));

      return newSelection;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedTareas((prev) => {
      if (prev.length === tareas.length) {
        window.dispatchEvent(new CustomEvent('selectionChanged', {
          detail: { hasSelections: false },
        }));
        return [];
      }
      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { hasSelections: true },
      }));
      return tareas.map((tarea) => tarea._id);
    });
  }, [tareas]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedTareas.length === 0) return;

    try {
      const results = await Promise.allSettled(
        selectedTareas.map((id) => deleteWithHistory(id)),
      );

      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value?.success !== false,
      ).length;
      const failed = results.length - successful;

      if (successful > 0) {
        enqueueSnackbar(`${successful} tarea(s) eliminada(s) exitosamente`, { variant: 'success' });
      }
      if (failed > 0) {
        enqueueSnackbar(`${failed} tarea(s) ya fueron eliminadas`, { variant: 'warning' });
      }

      setSelectedTareas([]);
      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { hasSelections: false },
      }));

      await fetchDataStable();
    } catch (error) {
      console.error('Error al eliminar tareas:', error);
      enqueueSnackbar('Error al eliminar las tareas', { variant: 'error' });
    }
  }, [selectedTareas, deleteWithHistory, enqueueSnackbar, fetchDataStable]);


  const handleDelete = useCallback(async (id) => {
    try {
      const result = await deleteWithHistory(id);

      if (result?.message === 'Ya eliminada') {
        enqueueSnackbar('La tarea ya fue eliminada', { variant: 'warning' });
        setTareas((prevTareas) => prevTareas.filter((tarea) => tarea._id !== id));
      } else {
        enqueueSnackbar('Tarea eliminada exitosamente', { variant: 'success' });
        setTareas((prevTareas) => prevTareas.filter((tarea) => tarea._id !== id));
      }
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
      enqueueSnackbar('Error al eliminar la tarea', { variant: 'error' });
    }
  }, [deleteWithHistory, enqueueSnackbar, setTareas]);

  const handleUpdateEstado = useCallback((tareaActualizada) => {
    setTareas((prevTareas) =>
      prevTareas.map((tarea) =>
        tarea._id === tareaActualizada._id ? tareaActualizada : tarea,
      ),
    );
    setEditingTarea((prev) =>
      prev && prev._id === tareaActualizada._id ? tareaActualizada : prev,
    );
  }, [setTareas]);

  const handleFormSubmit = useCallback(async (formData, tareaOverride = null) => {
    const editing = tareaOverride || editingTarea;
    try {
      const datosAEnviar = buildTareaPayload(formData, { editingTarea: editing, objetivos });
      let saved;

      if (editing) {
        saved = await updateWithHistory(editing._id, datosAEnviar, editing);
        enqueueSnackbar('Tarea actualizada exitosamente', { variant: 'success' });
        if (tareaOverride) {
          handleUpdateEstado(saved);
        }
      } else {
        saved = await createWithHistory(datosAEnviar);
        enqueueSnackbar('Tarea creada exitosamente', { variant: 'success' });
      }

      syncTareaToGoogleInBackground(saved || datosAEnviar, {
        onSynced: () => enqueueSnackbar('Sincronizada con Google Tasks', { variant: 'info' }),
        onError: (syncErr) => {
          console.warn('Sync Google Tasks tras guardar:', syncErr);
          enqueueSnackbar(
            syncErr.response?.data?.error || 'Tarea guardada; no se pudo sincronizar con Google',
            { variant: 'warning' },
          );
        },
      });

      if (!tareaOverride) {
        setIsFormOpen(false);
        setEditingTarea(null);
      }
      await fetchDataStable();
    } catch (error) {
      console.error('Error al guardar tarea:', error.response?.data || error.message);
      enqueueSnackbar(
        error.response?.data?.error || 'Error al guardar la tarea',
        { variant: 'error' },
      );
    }
  }, [
    editingTarea,
    objetivos,
    updateWithHistory,
    createWithHistory,
    enqueueSnackbar,
    fetchDataStable,
    handleUpdateEstado,
  ]);

  useEffect(() => {
    const handleHeaderAddButton = (event) => {
      if (event.detail.type === 'tarea') {
        openNewTareaForm();
      }
    };

    const handleAddTask = () => {
      openNewTareaForm();
    };

    const handleUndoTareaAction = async () => {
      try {
        await fetchDataStable();
      } catch (error) {
        console.error('Error al recargar datos después del undo:', error);
      }
    };

    const handleUndoAction = async (event) => {
      if (event.detail?.entity === 'tarea') {
        try {
          await fetchDataStable();
        } catch (error) {
          console.error('Error al recargar datos después del undo (fallback):', error);
        }
      }
    };

    const handleOpenGoogleTasksConfig = () => {
      setIsGoogleTasksConfigOpen(true);
    };

    const handleGoogleTasksSyncCompleted = async (event) => {
      await fetchDataStable();
      const { results } = event.detail || {};
      if (results?.fromGoogle?.created > 0 || results?.fromGoogle?.updated > 0) {
        enqueueSnackbar(
          `Se han sincronizado ${results.fromGoogle.created + results.fromGoogle.updated} tareas desde Google Tasks`,
          { variant: 'info' },
        );
      }
    };

    window.addEventListener('headerAddButtonClicked', handleHeaderAddButton);
    window.addEventListener('addTask', handleAddTask);
    window.addEventListener('undoAction', handleUndoAction);
    window.addEventListener('undoAction_tarea', handleUndoTareaAction);
    window.addEventListener('openGoogleTasksConfig', handleOpenGoogleTasksConfig);
    window.addEventListener('googleTasksSyncCompleted', handleGoogleTasksSyncCompleted);
    window.addEventListener('deleteSelectedTasks', handleDeleteSelected);
    window.addEventListener('selectAllTasks', handleSelectAll);

    return () => {
      window.removeEventListener('headerAddButtonClicked', handleHeaderAddButton);
      window.removeEventListener('addTask', handleAddTask);
      window.removeEventListener('undoAction', handleUndoAction);
      window.removeEventListener('undoAction_tarea', handleUndoTareaAction);
      window.removeEventListener('openGoogleTasksConfig', handleOpenGoogleTasksConfig);
      window.removeEventListener('googleTasksSyncCompleted', handleGoogleTasksSyncCompleted);
      window.removeEventListener('deleteSelectedTasks', handleDeleteSelected);
      window.removeEventListener('selectAllTasks', handleSelectAll);
    };
  }, [fetchDataStable, handleDeleteSelected, handleSelectAll, openNewTareaForm, enqueueSnackbar]);

  const tareasTableCommonProps = {
    showHabitCarousel: true,
    showCompleted,
    groupingEnabled: true,
    onSubmit: handleFormSubmit,
    onObjetivosUpdate: refetchObjetivos,
    onDelete: handleDelete,
    onUpdateEstado: handleUpdateEstado,
    isArchive: false,
    showValues,
    updateWithHistory,
    isMultiSelectMode: selectedTareas.length > 0,
    selectedTareas,
    onSelectTarea: handleSelectTarea,
    onActivateMultiSelect: () => {},
    onRefreshData: fetchDataStable,
    objetivos,
  };

  return {
    tareas,
    loading,
    objetivos,
    refetchObjetivos,
    isMobile,
    showCompleted,
    agendaView,
    tareasAgenda,
    tareasAhora,
    tareasLuego,
    tareasTableCommonProps,
    isFormOpen,
    setIsFormOpen,
    editingTarea,
    isGoogleTasksConfigOpen,
    setIsGoogleTasksConfigOpen,
    selectedTareas,
    handleDeactivateMultiSelect,
    handleFormSubmit,
    createWithHistory,
    updateWithHistory,
    deleteWithHistory,
  };
}
