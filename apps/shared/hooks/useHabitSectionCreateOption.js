import { useCallback, useMemo, useState } from 'react';
import { useHabits } from '../context/HabitsContext.jsx';
import { buildHabitManagerSections } from '../habits/form/habitsManagerUtils.js';

export const HABIT_SECTION_CREATE_LABEL = 'Nuevo grupo';

/**
 * Opciones de grupo + diálogo para crear/editar sección custom desde selects de formulario.
 */
export function useHabitSectionCreateOption({ onSectionCreated } = {}) {
  const { customSections, addHabitSection, updateHabitSection } = useHabits();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const sectionOptions = useMemo(
    () => buildHabitManagerSections(customSections),
    [customSections],
  );

  const closeGroupDialog = useCallback(() => {
    setGroupDialogOpen(false);
    setEditingSectionId(null);
  }, []);

  const openCreateGroupDialog = useCallback(() => {
    setEditingSectionId(null);
    setGroupDialogOpen(true);
  }, []);

  const openEditGroupDialog = useCallback((sectionId) => {
    setEditingSectionId(sectionId);
    setGroupDialogOpen(true);
  }, []);

  const handleSaveGroup = useCallback(async ({ label, icon }) => {
    try {
      setIsSavingGroup(true);
      if (editingSectionId) {
        await updateHabitSection(editingSectionId, { label, icon });
      } else {
        const section = await addHabitSection({ label, icon });
        if (section?.id) {
          onSectionCreated?.(section.id);
        }
      }
      closeGroupDialog();
    } catch {
      // manejado en contexto
    } finally {
      setIsSavingGroup(false);
    }
  }, [addHabitSection, closeGroupDialog, editingSectionId, onSectionCreated, updateHabitSection]);

  const editingSection = useMemo(
    () => (editingSectionId
      ? (customSections || []).find((entry) => entry?.id === editingSectionId) || null
      : null),
    [customSections, editingSectionId],
  );

  const sectionSelectProps = useMemo(() => ({
    onCreate: openCreateGroupDialog,
    createLabel: HABIT_SECTION_CREATE_LABEL,
  }), [openCreateGroupDialog]);

  const groupDialogProps = useMemo(() => ({
    open: groupDialogOpen,
    onClose: closeGroupDialog,
    onSave: handleSaveGroup,
    saving: isSavingGroup,
    mode: editingSectionId ? 'edit' : 'create',
    initialSection: editingSection,
  }), [closeGroupDialog, editingSection, editingSectionId, groupDialogOpen, handleSaveGroup, isSavingGroup]);

  return {
    sectionOptions,
    sectionSelectProps,
    groupDialogProps,
    openCreateGroupDialog,
    openEditGroupDialog,
  };
}
