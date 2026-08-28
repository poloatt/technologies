import React from 'react';
import { Box } from '@mui/material';
import RutinaDailyCadenceFranjaLayout from './RutinaDailyCadenceFranjaLayout';
import RutinaDayGroupList from './RutinaDayGroupList';

/** Lista Hoy/Hecho/No toca hoy para un bucket de cadencia. */
export default function RutinaCadenceBucketList({
  bucket,
  rutina,
  readOnly,
  onItemClick,
  onEditHabit,
  onReorderSection,
  habits,
  habitsPreferences = {},
  sortable = false,
  localDataBySection = {},
}) {
  if (bucket.id === 'DIARIO') {
    return (
      <RutinaDailyCadenceFranjaLayout
        bucket={bucket}
        rutina={rutina}
        readOnly={readOnly}
        onItemClick={onItemClick}
        onEditHabit={onEditHabit}
        habitsPreferences={habitsPreferences}
        localDataBySection={localDataBySection}
      />
    );
  }

  const sectionsInBucket = [...new Set(bucket.items.map((entry) => entry.section))];

  if (sectionsInBucket.length === 1) {
    const section = sectionsInBucket[0];
    return (
      <RutinaDayGroupList
        today={bucket.today}
        done={bucket.done}
        notToday={bucket.notToday}
        section={section}
        rutina={rutina}
        readOnly={readOnly}
        sortable={sortable}
        sectionHabits={habits?.[section] || []}
        habitsPreferences={habitsPreferences}
        localData={localDataBySection[section]}
        onReorder={(habitIds) => onReorderSection?.(section, habitIds)}
        onItemClick={(itemId, event, horario) => onItemClick(section, itemId, event, horario)}
        onDoneToggle={(itemId, event, horario) => onItemClick(section, itemId, event, horario)}
        onEditHabit={onEditHabit}
      />
    );
  }

  return sectionsInBucket.map((section) => {
    const sectionToday = bucket.today.filter((entry) => entry.section === section);
    const sectionDone = bucket.done.filter((entry) => entry.section === section);
    const sectionNotToday = bucket.notToday.filter((entry) => entry.section === section);
    if (sectionToday.length === 0 && sectionDone.length === 0 && sectionNotToday.length === 0) return null;

    const sectionLabel = bucket.items.find((entry) => entry.section === section)?.sectionLabel || section;

    return (
      <Box key={`${bucket.id}-${section}`} sx={{ mb: 1 }}>
        <RutinaDayGroupList
          today={sectionToday}
          done={sectionDone}
          notToday={sectionNotToday}
          section={section}
          sectionLabel={sectionLabel}
          rutina={rutina}
          readOnly={readOnly}
          sortable={sortable}
          sectionHabits={habits?.[section] || []}
          habitsPreferences={habitsPreferences}
          localData={localDataBySection[section]}
          onReorder={(habitIds) => onReorderSection?.(section, habitIds)}
          onItemClick={(itemId, event, horario) => onItemClick(section, itemId, event, horario)}
          onDoneToggle={(itemId, event, horario) => onItemClick(section, itemId, event, horario)}
          onEditHabit={onEditHabit}
        />
      </Box>
    );
  });
}
