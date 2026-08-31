import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { groupWeeklyCadenceByWeekday, resolveActiveDailyFranja, mergeLuegoWeekdayGroups } from '@shared/habits';
import { collapseSectionStackSx } from '@shared/styles/collapseSectionStyles';
import RutinaDayGroupList from '../section/RutinaDayGroupList';
import RutinaDoneSection from '../section/RutinaDoneSection';

/** Datos de pendientes semanales para incrustar en Luego del Diario. */
export function useWeeklyCadenceLuegoGroups(bucket, rutina) {
  return useMemo(() => {
    if (!bucket) return { pendingWeekdayGroups: [], allDoneItems: [] };
    const weekdayGroups = groupWeeklyCadenceByWeekday(bucket, rutina);
    return {
      pendingWeekdayGroups: weekdayGroups.filter((group) => group.pending.length > 0),
      allDoneItems: weekdayGroups.flatMap((group) => group.done),
    };
  }, [bucket, rutina]);
}

/**
 * Bucket Semanal (standalone): pendientes por día dentro de «Luego»
 * con subsecciones floating (Lunes, Martes, …) + Hecho.
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
  luegoWeekdayGroupsExtra = [],
  hideNotToday = false,
}) {
  const { pendingWeekdayGroups, allDoneItems } = useWeeklyCadenceLuegoGroups(bucket, rutina);
  const luegoWeekdayGroups = useMemo(
    () => mergeLuegoWeekdayGroups(pendingWeekdayGroups, luegoWeekdayGroupsExtra),
    [pendingWeekdayGroups, luegoWeekdayGroupsExtra],
  );

  const handleDoneToggle = (entrySection, itemId, horario) => {
    onItemClick(entrySection, itemId, null, horario);
  };

  return (
    <Box sx={collapseSectionStackSx}>
      {luegoWeekdayGroups.length > 0 && (
        <RutinaDayGroupList
          today={[]}
          done={[]}
          notToday={[]}
          luego={[]}
          luegoWeekdayGroups={luegoWeekdayGroups}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          sortable={!readOnly && typeof onReorderSection === 'function'}
          multiSection
          hideDone
          hideGroupHeadings
          showSectionCounts
          expandableCarousels
          activeFranja={resolveActiveDailyFranja(rutina)}
          habitsPreferences={habitsPreferences}
          localDataBySection={localDataBySection}
          rowKeyPrefix="weekly-cadence"
          onReorderSection={onReorderSection}
          onItemClick={(itemId, event, horario, entrySection) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
          onDoneToggle={(entrySection, itemId, event, horario) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
        />
      )}

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
