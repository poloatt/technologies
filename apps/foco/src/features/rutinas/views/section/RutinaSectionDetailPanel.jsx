/**
 * @deprecated Vista por grupo retirada de la UI (ago 2026). RutinaTable usa solo cadencia.
 * Pendiente: eliminar o readaptar este panel de detalle por sección.
 */
import React, { useState, useMemo, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import { useHabits, useRutinas } from '@shared/context';

import RutinaDayGroupList from './RutinaDayGroupList';

import { groupSectionHabitsByFranjaSchedule, isViewingRutinaToday } from '@shared/habits';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import { RUTINA_HISTORICAL_COPY } from '@shared/copy/agendaTerminology';

import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';

import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';

import useRutinaItemToggle from '../../hooks/useRutinaItemToggle';

import useRutinaSectionLocalData from '../../hooks/useRutinaSectionLocalData';

export default function RutinaSectionDetailPanel({
  section,
  rutina,
  habits,
  habitsPreferences = {},
  readOnly = false,
}) {
  const { reorderHabits } = useHabits();
  const { markItemComplete, patchRutinaSection } = useRutinas();
  const { habitChains, prefsReady } = useHabitsPreferences();
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

  const habitIconsMap = useMemo(
    () => buildHabitSectionIconsMap(habits).iconsMap,
    [habits],
  );

  const habitGroups = useMemo(
    () => groupSectionHabitsByFranjaSchedule({
      section,
      rutina,
      habits,
      habitsPreferences,
      habitChains: prefsReady ? habitChains : [],
      iconsMap: habitIconsMap,
      localData,
    }),
    [section, rutina, habits, habitsPreferences, habitChains, prefsReady, habitIconsMap, localData],
  );

  const {
    sinHacer,
    ahora,
    luego,
    done,
    notToday,
    activeFranja,
    activeFranjaLabel,
  } = habitGroups;
  const useSectionFranjaLayout = isViewingRutinaToday(rutina);
  const isHistorical = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';

  const handleReorderHabits = useCallback(async (habitIds) => {
    if (!habitIds?.length || !section) return;
    try {
      await reorderHabits(section, habitIds);
    } catch {
      // feedback en HabitsContext
    }
  }, [reorderHabits, section]);

  const hasAny = sinHacer.length > 0 || ahora.length > 0 || luego.length > 0 || done.length > 0 || notToday.length > 0;

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
        today={ahora}
        sinHacer={sinHacer}
        luego={luego}
        done={done}
        notToday={notToday}
        section={section}
        rutina={rutina}
        readOnly={readOnly}
        sortable
        sectionHabits={habits?.[section] || []}
        habits={habits}
        habitsPreferences={habitsPreferences}
        useSectionFranjaLayout={useSectionFranjaLayout}
        activeFranja={activeFranja}
        activeFranjaLabel={isHistorical ? RUTINA_HISTORICAL_COPY.unmarked : activeFranjaLabel}
        useFranjaHeadings={isHistorical}
        sectionLabel={isHistorical ? RUTINA_HISTORICAL_COPY.unmarked : undefined}
        showSectionCounts={isHistorical}
        doneHeadingLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : undefined}
        doneTodayLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : undefined}
        doneBeforeLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneBeforeThatDay : undefined}
        doneDefaultExpanded={isHistorical}
        doneCollapsible={isHistorical}
        onReorder={handleReorderHabits}
        onItemClick={handleItemClick}
        onDoneToggle={handleItemClick}
        localData={localData}
        stackVariant="compact"
      />
    </Box>
  );
}
