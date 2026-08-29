import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { groupWeeklyCadenceByWeekday } from '@shared/habits';
import RutinaDayGroupList from './RutinaDayGroupList';
import RutinaDoneSection from './RutinaDoneSection';

/**
 * Bucket Semanal: subgrupos por día (Lunes, Martes, …) + Hecho.
 * Los hábitos que tocan hoy se muestran en Diario, no aquí.
 */
export default function RutinaWeeklyCadenceDayLayout({
  bucket,
  rutina,
  readOnly,
  onItemClick,
  habitsPreferences = {},
  localDataBySection = {},
}) {
  const weekdayGroups = useMemo(
    () => groupWeeklyCadenceByWeekday(bucket, rutina),
    [bucket, rutina],
  );

  const allDoneItems = useMemo(
    () => weekdayGroups.flatMap((group) => group.done),
    [weekdayGroups],
  );

  const hasContentAboveDone = weekdayGroups.some((group) => group.pending.length > 0);

  const handleDoneToggle = (entrySection, itemId, horario) => {
    onItemClick(entrySection, itemId, null, horario);
  };

  return (
    <Box>
      {weekdayGroups.map((group) => {
        if (group.pending.length === 0) return null;

        return (
          <Box key={group.weekdayKey} sx={{ mb: 1 }}>
            <RutinaDayGroupList
              today={group.pending}
              done={[]}
              notToday={[]}
              rutina={rutina}
              readOnly={readOnly}
              sortable={false}
              multiSection
              hideDone
              useFranjaHeadings
              sectionLabel={group.weekdayLabel}
              habitsPreferences={habitsPreferences}
              localDataBySection={localDataBySection}
              rowKeyPrefix={`wd-${group.weekdayKey}`}
              onItemClick={(itemId, event, horario, entrySection) => {
                onItemClick(entrySection, itemId, event, horario);
              }}
              onDoneToggle={(entrySection, itemId, event, horario) => {
                onItemClick(entrySection, itemId, event, horario);
              }}
            />
          </Box>
        );
      })}

      <RutinaDoneSection
        items={allDoneItems}
        rutina={rutina}
        habitsPreferences={habitsPreferences}
        readOnly={readOnly}
        onToggle={handleDoneToggle}
        showDivider={hasContentAboveDone}
      />
    </Box>
  );
}
