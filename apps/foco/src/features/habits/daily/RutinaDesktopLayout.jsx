import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useHabits, useRutinas } from '@shared/context';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { getDefaultSelectedSection } from '@shared/habits';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import useHabitCarouselToggle from '@foco/features/habits/carousel/useHabitCarouselToggle';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import useRutinaItemToggle from '@foco/features/habits/hooks/useRutinaItemToggle';
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
  const { markItemComplete, patchRutinaSection } = useRutinas();
  const dragRef = useRef({ moved: false });
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

  const handleToggle = useHabitCarouselToggle({
    mode: 'ahora',
    interactive: !readOnly,
    dragRef,
    rutinaHoy: rutina,
    markItemComplete,
    patchRutinaSection,
    currentTimeOfDay: getCurrentTimeOfDay(),
    habitsPreferences: prefs,
  });

  const toggleItem = useRutinaItemToggle({
    rutina,
    habitsPreferences: prefs,
    markItemComplete,
    patchRutinaSection,
    readOnly,
  });

  const handleItemClick = useCallback((itemId, event, horario = null) => {
    toggleItem(selectedSection, itemId, horario, event);
  }, [toggleItem, selectedSection]);

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
        onItemClick={handleItemClick}
        onToggle={handleToggle}
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
