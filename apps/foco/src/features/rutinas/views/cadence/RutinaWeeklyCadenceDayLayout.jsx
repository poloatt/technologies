import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { groupWeeklyCadenceByWeekday } from '@shared/habits';
import { collapseSectionStackSx } from '@shared/styles/collapseSectionStyles';
import RutinaDayGroupList from '../section/RutinaDayGroupList';
import RutinaDoneSection from '../section/RutinaDoneSection';

/**
 * Bucket Semanal: subgrupos por día (Lunes, Martes, …) + Hecho.
 * Los hábitos que tocan hoy se muestran en Diario, no aquí.
 */
export default function RutinaWeeklyCadenceDayLayout({
  bucket,
  rutina,
  readOnly,
  onItemClick,
  habits = null,
  habitsPreferences = {},
  localDataBySection = {},
  includeDoneSection = true,
  onReorderSection,
}) {
  const weekdayGroups = useMemo(
    () => groupWeeklyCadenceByWeekday(bucket, rutina),
    [bucket, rutina],
  );

  const allDoneItems = useMemo(
    () => weekdayGroups.flatMap((group) => group.done),
    [weekdayGroups],
  );

  const handleDoneToggle = (entrySection, itemId, horario) => {
    onItemClick(entrySection, itemId, null, horario);
  };

  return (
    <Box sx={collapseSectionStackSx}>
      {weekdayGroups.map((group) => {
        if (group.pending.length === 0) return null;

        return (
          <RutinaDayGroupList
            key={group.weekdayKey}
            today={group.pending}
            done={[]}
            notToday={[]}
            rutina={rutina}
            habits={habits}
            readOnly={readOnly}
            sortable={!readOnly && typeof onReorderSection === 'function'}
            multiSection
            hideDone
            hideGroupHeadings
            useFranjaHeadings
            sectionLabel={group.weekdayLabel}
            habitsPreferences={habitsPreferences}
            localDataBySection={localDataBySection}
            rowKeyPrefix={`wd-${group.weekdayKey}`}
            onReorderSection={onReorderSection}
            onItemClick={(itemId, event, horario, entrySection) => {
              onItemClick(entrySection, itemId, event, horario);
            }}
            onDoneToggle={(entrySection, itemId, event, horario) => {
              onItemClick(entrySection, itemId, event, horario);
            }}
          />
        );
      })}

      {includeDoneSection && (
        <RutinaDoneSection
          items={allDoneItems}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={handleDoneToggle}
        />
      )}
    </Box>
  );
}
