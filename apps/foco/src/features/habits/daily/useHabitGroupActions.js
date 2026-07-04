import { useCallback, useState } from 'react';
import { useHabits } from '@shared/context';
import { resolveSectionLabel } from '@shared/habits';

export default function useHabitGroupActions({
  customSections = [],
  selectedSection,
  onSelectSection,
} = {}) {
  const { addHabitSection, updateHabitSection, deleteHabitSection } = useHabits();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState('create');
  const [editingSection, setEditingSection] = useState(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const openCreateGroupDialog = useCallback(() => {
    setGroupDialogMode('create');
    setEditingSection(null);
    setGroupDialogOpen(true);
  }, []);

  const openEditGroupDialog = useCallback((sectionId) => {
    const section = customSections.find((entry) => entry.id === sectionId);
    if (!section) return;
    setGroupDialogMode('edit');
    setEditingSection(section);
    setGroupDialogOpen(true);
  }, [customSections]);

  const handleSaveGroup = useCallback(async ({ label, icon }) => {
    try {
      setIsSavingGroup(true);
      if (groupDialogMode === 'edit' && editingSection?.id) {
        await updateHabitSection(editingSection.id, { label, icon });
      } else {
        const section = await addHabitSection({ label, icon });
        if (section?.id) {
          onSelectSection?.(section.id);
        }
      }
      setGroupDialogOpen(false);
      setEditingSection(null);
    } catch {
      // manejado en contexto
    } finally {
      setIsSavingGroup(false);
    }
  }, [
    groupDialogMode,
    editingSection,
    addHabitSection,
    updateHabitSection,
    onSelectSection,
  ]);

  const handleDeleteGroup = useCallback(async (sectionId) => {
    const label = resolveSectionLabel(sectionId, customSections);
    const confirmed = window.confirm(`¿Eliminar el grupo "${label}"?`);
    if (!confirmed) return;

    try {
      await deleteHabitSection(sectionId);
      if (selectedSection === sectionId) {
        onSelectSection?.('bodyCare');
      }
    } catch {
      // manejado en contexto
    }
  }, [customSections, deleteHabitSection, selectedSection, onSelectSection]);

  return {
    groupDialogOpen,
    setGroupDialogOpen,
    groupDialogMode,
    editingSection,
    isSavingGroup,
    openCreateGroupDialog,
    openEditGroupDialog,
    handleSaveGroup,
    handleDeleteGroup,
  };
}
