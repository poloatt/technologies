import React from 'react';
import { Box, Skeleton } from '@mui/material';
import HabitGroupTabs from '@shared/components/habits/HabitGroupTabs.jsx';
import { isCustomHabitSection } from '@shared/habits';
import HabitsManagerGroupHabits from './HabitsManagerGroupHabits';

/**
 * Primera mitad del Habit Manager: selector de hábito.
 * Pestañas de grupo (flechas + crear/editar grupo) y, debajo, la lista scrolleable
 * de hábitos del grupo con "+ Agregar hábito al grupo" como primer ítem.
 * Ocupa todo el alto disponible del contenedor padre (que define el alto).
 */
export default function HabitsManagerHabitPicker({
  sections = [],
  habits = {},
  activeSection,
  onSectionChange,
  selectedHabitId = null,
  onSelectHabit,
  onAddHabit,
  onCreateSection,
  createSectionLabel = 'Nuevo grupo',
  onEditSection,
  loading = false,
}) {
  const hasAnyHabit = sections.some((section) => (habits[section.value] || []).length > 0);

  if (loading && !hasAnyHabit) {
    return (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
    );
  }

  const sectionHabits = Array.isArray(habits[activeSection]) ? habits[activeSection] : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ px: 1.5, pt: 0.5, flexShrink: 0 }}>
        <HabitGroupTabs
          sections={sections}
          value={activeSection}
          onChange={onSectionChange}
          onCreate={onCreateSection}
          createLabel={createSectionLabel}
          onEdit={isCustomHabitSection(activeSection) && onEditSection
            ? () => onEditSection(activeSection)
            : undefined}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pb: 1 }}>
        <HabitsManagerGroupHabits
          habits={sectionHabits}
          selectedHabitId={selectedHabitId}
          onSelect={(habitId) => onSelectHabit?.(habitId, activeSection)}
          onAdd={() => onAddHabit?.(activeSection)}
        />
      </Box>
    </Box>
  );
}
