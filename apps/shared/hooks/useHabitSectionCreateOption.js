import { useCallback, useMemo, useState } from 'react';
import { useHabits } from '../context/HabitsContext.jsx';
import { buildHabitManagerSections } from '../habits/form/habitsManagerUtils.js';

export const HABIT_SECTION_CREATE_LABEL = 'Nuevo grupo';

/**
 * Opciones de grupo + diálogo para crear sección custom desde selects de formulario.
 */
export function useHabitSectionCreateOption({ onSectionCreated } = {}) {
  const { customSections, addHabitSection } = useHabits();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const sectionOptions = useMemo(
    () => buildHabitManagerSections(customSections),
    [customSections],
  );

  const openCreateGroupDialog = useCallback(() => {
    setGroupDialogOpen(true);
  }, []);

  const handleSaveGroup = useCallback(async ({ label, icon }) => {
    try {
      setIsSavingGroup(true);
      const section = await addHabitSection({ label, icon });
      if (section?.id) {
        onSectionCreated?.(section.id);
      }
      setGroupDialogOpen(false);
    } catch {
      // manejado en contexto
    } finally {
      setIsSavingGroup(false);
    }
  }, [addHabitSection, onSectionCreated]);

  const sectionSelectProps = useMemo(() => ({
    onCreate: openCreateGroupDialog,
    createLabel: HABIT_SECTION_CREATE_LABEL,
  }), [openCreateGroupDialog]);

  const groupDialogProps = useMemo(() => ({
    open: groupDialogOpen,
    onClose: () => setGroupDialogOpen(false),
    onSave: handleSaveGroup,
    saving: isSavingGroup,
    mode: 'create',
    initialSection: null,
  }), [groupDialogOpen, handleSaveGroup, isSavingGroup]);

  return {
    sectionOptions,
    sectionSelectProps,
    groupDialogProps,
    openCreateGroupDialog,
  };
}
