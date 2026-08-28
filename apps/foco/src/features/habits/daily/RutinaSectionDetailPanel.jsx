import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useHabits } from '@shared/context';
import RutinaSectionCarousel from './RutinaSectionCarousel';
import RutinaDayGroupList from './RutinaDayGroupList';
import HabitFormDialog from '@shared/components/HabitFormDialog';
import { groupSectionHabitsByDaySchedule } from '@shared/habits';
import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';

export default function RutinaSectionDetailPanel({
  section,
  rutina,
  habits,
  habitsPreferences = {},
  readOnly = false,
  onItemClick,
  onToggle,
}) {
  const { reorderHabits } = useHabits();
  const [editingHabitDialog, setEditingHabitDialog] = useState({
    open: false,
    habit: null,
    section: null,
  });

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const { today, notToday } = useMemo(
    () => groupSectionHabitsByDaySchedule({
      section,
      rutina,
      habits,
      habitsPreferences,
      iconsMap: habitIconsMap,
    }),
    [section, rutina, habits, habitsPreferences, habitIconsMap],
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

  const hasAny = today.length > 0 || notToday.length > 0;

  if (!hasAny) {
    return (
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <RutinaSectionCarousel
          section={section}
          rutina={rutina}
          habits={habits}
          habitsPreferences={habitsPreferences}
          onToggle={onToggle}
          interactive={!readOnly}
        />
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No hay hábitos en esta sección
          </Typography>
        </Box>
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
        <RutinaSectionCarousel
          section={section}
          rutina={rutina}
          habits={habits}
          habitsPreferences={habitsPreferences}
          onToggle={onToggle}
          interactive={!readOnly}
        />
        <RutinaDayGroupList
          today={today}
          notToday={notToday}
          section={section}
          rutina={rutina}
          readOnly={readOnly}
          sortable
          sectionHabits={habits?.[section] || []}
          onReorder={handleReorderHabits}
          onItemClick={onItemClick}
          onEditHabit={handleEditHabit}
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
