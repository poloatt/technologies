import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { useHabits } from '@shared/context';
import { getDefaultSelectedSection } from '@shared/habits';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import RutinaSectionNav from './RutinaSectionNav';
import RutinaSectionDetailPanel from './RutinaSectionDetailPanel';
import useHabitGroupActions from './useHabitGroupActions';

/** Layout master-detail para rutinas en desktop (md+). */
export default function RutinaDesktopLayout({
  rutina,
  readOnly = false,
}) {
  const { habits, customSections } = useHabits();
  const { habitsPreferences, prefsReady } = useHabitsPreferences();
  const prefs = prefsReady ? (habitsPreferences || {}) : {};
  const [selectedSection, setSelectedSection] = useState(() =>
    getDefaultSelectedSection(rutina, habits, prefs),
  );

  const {
    groupDialogOpen,
    setGroupDialogOpen,
    groupDialogMode,
    editingSection,
    isSavingGroup,
    openCreateGroupDialog,
    openEditGroupDialog,
    handleSaveGroup,
    handleDeleteGroup,
  } = useHabitGroupActions({
    customSections,
    selectedSection,
    onSelectSection: setSelectedSection,
  });

  useEffect(() => {
    const onOpenAddHabitGroup = () => openCreateGroupDialog();
    window.addEventListener('openAddHabitGroup', onOpenAddHabitGroup);
    return () => window.removeEventListener('openAddHabitGroup', onOpenAddHabitGroup);
  }, [openCreateGroupDialog]);

  useEffect(() => {
    if (!prefsReady) return;
    setSelectedSection(getDefaultSelectedSection(rutina, habits, prefs));
  }, [rutina?._id, habits, prefsReady, habitsPreferences]);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        width: '100%',
        minHeight: 0,
        alignItems: 'flex-start',
      }}
    >
      <RutinaSectionNav
        rutina={rutina}
        habits={habits}
        habitsPreferences={prefs}
        customSections={customSections}
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
        onAddGroup={openCreateGroupDialog}
        onEditGroup={openEditGroupDialog}
        onDeleteGroup={handleDeleteGroup}
        readOnly={readOnly}
      />
      <RutinaSectionDetailPanel
        section={selectedSection}
        rutina={rutina}
        habits={habits}
        habitsPreferences={prefs}
        readOnly={readOnly}
      />
      <HabitGroupFormDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onSave={handleSaveGroup}
        saving={isSavingGroup}
        mode={groupDialogMode}
        initialSection={editingSection}
      />
    </Box>
  );
}
