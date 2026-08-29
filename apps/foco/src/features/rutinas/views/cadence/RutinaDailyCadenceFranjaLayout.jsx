import React, { useMemo } from 'react';

import { Box, Typography } from '@mui/material';

import {

  groupDailyCadenceByFranja,

  resolveActiveDailyFranja,

  isViewingRutinaToday,

  buildDailyCadenceDisplaySections,

} from '@shared/habits';

import { getTimeOfDayLabel } from '@shared/utils/timeOfDayUtils';

import { DAILY_CADENCE_SECTION_COPY } from '@shared/copy/agendaTerminology';

import RutinaDayGroupList from '../section/RutinaDayGroupList';

import RutinaFranjaIconCarousel from './RutinaFranjaIconCarousel';

import RutinaDoneSection from '../section/RutinaDoneSection';



const FRANJA_HEADING_SX = {
  px: 0.5,
  py: 0.5,
  display: 'block',
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.7rem',
};



/**

 * Bucket Diario con secciones dinámicas según la franja activa:

 * Mañana → Mañana, Tarde, Noche | Tarde → Mañana, Ahora, Noche | Noche → Sin hacer, Noche.

 * Hoy: franja activa en lista; el resto en carrusel horizontal.

 */

export default function RutinaDailyCadenceFranjaLayout({

  bucket,

  rutina,

  readOnly,

  onItemClick,

  habits = null,

  habitsPreferences = {},

  localDataBySection = {},

  includeDoneSection = true,

  useShortFranjaLabels = false,

  onReorderSection,

}) {

  const franjaGroups = useMemo(

    () => groupDailyCadenceByFranja(bucket, rutina).map((group) => ({

      ...group,

      franjaLabel: useShortFranjaLabels

        ? getTimeOfDayLabel(group.franjaKey)

        : group.franjaLabel,

    })),

    [bucket, rutina, useShortFranjaLabels],

  );



  const activeFranja = useMemo(() => resolveActiveDailyFranja(rutina), [rutina]);

  const isViewingToday = useMemo(() => isViewingRutinaToday(rutina), [rutina]);



  const groupsByKey = useMemo(

    () => Object.fromEntries(franjaGroups.map((group) => [group.franjaKey, group])),

    [franjaGroups],

  );



  const displaySections = useMemo(

    () => buildDailyCadenceDisplaySections({

      groupsByKey,

      activeFranja,

      isViewingToday,

      labels: DAILY_CADENCE_SECTION_COPY,

    }),

    [groupsByKey, activeFranja, isViewingToday],

  );



  const allDoneItems = useMemo(() => {

    const seen = new Set();

    return franjaGroups.flatMap((group) => group.done).filter((entry) => {

      const key = `${entry.section}:${entry.itemId}`;

      if (seen.has(key)) return false;

      seen.add(key);

      return true;

    });

  }, [franjaGroups]);



  const handleCarouselToggle = (entrySection, itemId, horario) => {

    onItemClick(entrySection, itemId, null, horario);

  };



  const handleDoneToggle = (entrySection, itemId, horario) => {

    onItemClick(entrySection, itemId, null, horario);

  };



  const renderDayGroup = (group, sectionId) => (

    <RutinaDayGroupList

      today={group.today}

      done={group.done}

      notToday={group.notToday}

      rutina={rutina}

      habits={habits}

      readOnly={readOnly}

      sortable={!readOnly && typeof onReorderSection === 'function'}

      multiSection

      hideDone

      hideGroupHeadings

      useFranjaHeadings

      sectionLabel={group.franjaLabel}

      habitsPreferences={habitsPreferences}

      localDataBySection={localDataBySection}

      rowKeyPrefix={sectionId}

      onReorderSection={onReorderSection}

      onItemClick={(itemId, event, horario, entrySection) => {

        onItemClick(entrySection, itemId, event, horario);

      }}

      onDoneToggle={(entrySection, itemId, event, horario) => {

        onItemClick(entrySection, itemId, event, horario);

      }}

    />

  );



  const hasFranjaPending = (group) => group

    && (group.today.length > 0 || group.notToday.length > 0);



  const hasContentAboveDone = displaySections.some(

    (section) => hasFranjaPending(section.group),

  );



  const renderDisplaySection = (section) => {

    const group = section.group;

    if (!hasFranjaPending(group)) return null;



    const groupForRender = { ...group, franjaLabel: section.label };



    if (isViewingToday && section.isActive) {

      return (

        <Box key={section.id} sx={{ mb: 1 }}>

          {renderDayGroup(groupForRender, section.id)}

        </Box>

      );

    }



    const carouselItems = isViewingToday

      ? group.today

      : [...group.today, ...group.notToday];



    return (

      <Box key={section.id} sx={{ mb: 1 }}>

        <Typography variant="caption" sx={FRANJA_HEADING_SX}>

          {section.label}

        </Typography>

        <RutinaFranjaIconCarousel

          pending={carouselItems}

          franjaKey={section.franjaKey}

          activeFranjaKey={activeFranja}

          rutina={rutina}

          habitsPreferences={habitsPreferences}

          readOnly={readOnly}

          onToggle={handleCarouselToggle}

        />

      </Box>

    );

  };



  return (

    <Box>

      {displaySections.map(renderDisplaySection)}



      {includeDoneSection && (

        <RutinaDoneSection

          items={allDoneItems}

          rutina={rutina}

          habitsPreferences={habitsPreferences}

          readOnly={readOnly}

          onToggle={handleDoneToggle}

          showDivider={hasContentAboveDone}

        />

      )}

    </Box>

  );

}


