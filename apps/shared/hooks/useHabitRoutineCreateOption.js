import { useCallback, useMemo, useState } from 'react';

/**
 * Diálogo para crear (o editar) rutina desde selects de formulario.
 */
export function useHabitRoutineCreateOption({ onRoutineCreated, onRoutineEdited } = {}) {
  const [routineDialogOpen, setRoutineDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [initialLabel, setInitialLabel] = useState('');
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);

  const openCreateRoutineDialog = useCallback(() => {
    setDialogMode('create');
    setInitialLabel('');
    setRoutineDialogOpen(true);
  }, []);

  const openEditRoutineDialog = useCallback((label = '') => {
    setDialogMode('edit');
    setInitialLabel(label || '');
    setRoutineDialogOpen(true);
  }, []);

  const closeRoutineDialog = useCallback(() => {
    setRoutineDialogOpen(false);
    setInitialLabel('');
    setDialogMode('create');
  }, []);

  const handleSaveRoutine = useCallback(async ({ label }) => {
    try {
      setIsSavingRoutine(true);
      if (dialogMode === 'edit') {
        await onRoutineEdited?.({ label });
      } else {
        await onRoutineCreated?.({ label });
      }
      closeRoutineDialog();
    } catch {
      // manejado en callback
    } finally {
      setIsSavingRoutine(false);
    }
  }, [closeRoutineDialog, dialogMode, onRoutineCreated, onRoutineEdited]);

  const routineDialogProps = useMemo(() => ({
    open: routineDialogOpen,
    onClose: closeRoutineDialog,
    onSave: handleSaveRoutine,
    saving: isSavingRoutine,
    mode: dialogMode,
    initialLabel,
  }), [closeRoutineDialog, dialogMode, handleSaveRoutine, initialLabel, isSavingRoutine, routineDialogOpen]);

  return {
    openCreateRoutineDialog,
    openEditRoutineDialog,
    routineDialogProps,
  };
}
