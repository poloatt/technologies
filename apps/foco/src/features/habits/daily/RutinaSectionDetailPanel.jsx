import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useHabits, useRutinas } from '@shared/context';
import RutinaDayGroupList from './RutinaDayGroupList';
import HabitFormDialog from '@shared/components/HabitFormDialog';
import { groupSectionHabitsByDaySchedule } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';
import useRutinaItemToggle from '@foco/features/habits/hooks/useRutinaItemToggle';
import useRutinaSectionLocalData from '@foco/features/habits/hooks/useRutinaSectionLocalData';

export default function RutinaSectionDetailPanel({
  section,
  rutina,
  habits,
  habitsPreferences = {},
  readOnly = false,
}) {
  const { reorderHabits } = useHabits();
  const { markItemComplete, patchRutinaSection } = useRutinas();
  const sectionData = rutina?.[section] || {};
  const [localData, setLocalData] = useRutinaSectionLocalData(section, sectionData, rutina);

  const toggleItem = useRutinaItemToggle({
    rutina,
    habitsPreferences,
    markItemComplete,
    patchRutinaSection,
    readOnly,
    getSectionOverrides: () => localData,
    onOptimisticValue: (_sec, itemId, newValue) => {
      setLocalData((prev) => ({ ...prev, [itemId]: newValue }));
    },
    onRevertValue: (_sec, itemId, previousValue) => {
      setLocalData((prev) => ({ ...prev, [itemId]: previousValue }));
    },
    onServerValue: (_sec, itemId, serverValue) => {
      setLocalData((prev) => ({ ...prev, [itemId]: serverValue }));
    },
  });

  const handleItemClick = useCallback((itemId, event, horario = null) => {
    toggleItem(section, itemId, horario, event);
  }, [toggleItem, section]);
  const [editingHabitDialog, setEditingHabitDialog] = useState({
    open: false,
    habit: null,
    section: null,
  });

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const { today, done, notToday } = useMemo(
    () => groupSectionHabitsByDaySchedule({
      section,
      rutina,
      habits,
      habitsPreferences,
      iconsMap: habitIconsMap,
      localData,
    }),
    [section, rutina, habits, habitsPreferences, habitIconsMap, localData],
  );

  const handleEditHabit = useCallback((habit, habitSection) => {
    setEditingHabitDialog({ open: true, habit, section: habitSection });
  }, []);

  const handleReorderHabits = useCallback(async (habitIds) => {
    if (!habitIds?.length || !section) return;
    try {
      await reorderHabits(section, habitIds);
    } catch {
      // feedback en HabitsContext
    }
  }, [reorderHabits, section]);

  const hasAny = today.length > 0 || done.length > 0 || notToday.length > 0;

  if (!hasAny) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos en esta sección
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        role="region"
        aria-label="Detalle de hábitos"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <RutinaDayGroupList
          today={today}
          done={done}
          notToday={notToday}
          section={section}
          rutina={rutina}
          readOnly={readOnly}
          sortable
          sectionHabits={habits?.[section] || []}
          habitsPreferences={habitsPreferences}
          onReorder={handleReorderHabits}
          onItemClick={handleItemClick}
          onDoneToggle={handleItemClick}
          onEditHabit={handleEditHabit}
          localData={localData}
        />
      </Box>

      <HabitFormDialog
        open={editingHabitDialog.open}
        onClose={() => setEditingHabitDialog({ open: false, habit: null, section: null })}
        editingHabit={editingHabitDialog.habit}
        editingSection={editingHabitDialog.section}
      />
    </>
  );
}
