import React, { useState, useMemo, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import { useSnackbar } from 'notistack';

import { useHabits, useRutinas } from '@shared/context';

import RutinaDayGroupList from './RutinaDayGroupList';

import { groupSectionHabitsByFranjaSchedule, isViewingRutinaToday } from '@shared/habits';

import { buildHabitSectionIconsMap } from '@shared/utils/habitSectionIcons';

import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';

import useRutinaItemToggle from '../../hooks/useRutinaItemToggle';

import useRutinaSectionLocalData from '../../hooks/useRutinaSectionLocalData';

import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';



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

  const { enqueueSnackbar } = useSnackbar();

  const sectionData = rutina?.[section] || {};

  const [localData, setLocalData] = useRutinaSectionLocalData(section, sectionData, rutina);



  const handleChainStepComplete = useCallback(({ nextStep, nextLabel }) => {

    const el = document.getElementById(`habit-row-${nextStep.section}-${nextStep.habitId}`);

    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    enqueueSnackbar(HABIT_CHAIN_COPY.nextSnackbar(nextLabel), { variant: 'info', autoHideDuration: 3500 });

  }, [enqueueSnackbar]);



  const toggleItem = useRutinaItemToggle({

    rutina,

    habits,

    habitsPreferences,

    habitChains: prefsReady ? habitChains : [],

    markItemComplete,

    patchRutinaSection,

    readOnly,

    getSectionOverrides: () => localData,

    getLocalDataBySection: () => ({ [section]: localData }),

    onOptimisticValue: (_sec, itemId, newValue) => {

      setLocalData((prev) => ({ ...prev, [itemId]: newValue }));

    },

    onRevertValue: (_sec, itemId, previousValue) => {

      setLocalData((prev) => ({ ...prev, [itemId]: previousValue }));

    },

    onServerValue: (_sec, itemId, serverValue) => {

      setLocalData((prev) => ({ ...prev, [itemId]: serverValue }));

    },

    onChainStepComplete: handleChainStepComplete,

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
        activeFranjaLabel={activeFranjaLabel}
        onReorder={handleReorderHabits}
        onItemClick={handleItemClick}
        onDoneToggle={handleItemClick}
        localData={localData}
        stackVariant="compact"
      />

    </Box>

  );

}


