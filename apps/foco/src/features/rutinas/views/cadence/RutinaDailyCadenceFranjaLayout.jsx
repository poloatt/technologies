import React, { useMemo, useState, useCallback } from 'react';

import { Box, Typography } from '@mui/material';
import CollapseSectionToggle from '@shared/components/common/CollapseSectionToggle';
import {
  collapseSectionStackSx,
  getCollapseSectionCarouselBodySx,
} from '@shared/styles/collapseSectionStyles';
import useResponsive from '@shared/hooks/useResponsive';

import {
  groupDailyCadenceByFranja,
  groupDailyCadenceBucketByFranjaSchedule,
  dedupeCadenceEntries,
  resolveActiveDailyFranja,
  isViewingRutinaToday,
  buildDailyCadenceDisplaySections,
} from '@shared/habits';

import { getTimeOfDayLabel } from '@shared/utils/timeOfDayUtils';

import { DAILY_CADENCE_SECTION_COPY, RUTINA_HISTORICAL_COPY } from '@shared/copy/agendaTerminology';

import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';

import RutinaDayGroupList from '../section/RutinaDayGroupList';

import RutinaFranjaIconCarousel from './RutinaFranjaIconCarousel';

import RutinaDoneSection from '../section/RutinaDoneSection';

/**
 * Bucket Diario con secciones dinámicas según la franja activa:
 * Hoy → Sin hacer / Ahora / Luego (paridad con vista Grupo).
 * Otros días → Mañana, Tarde, Noche estáticos.
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
  const { isMobileOrTablet } = useResponsive();
  const isViewingToday = useMemo(() => isViewingRutinaToday(rutina), [rutina]);
  const isHistorical = useMemo(
    () => rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical',
    [rutina],
  );
  const [expandedFranjaKeys, setExpandedFranjaKeys] = useState(() => new Set());

  const toggleFranjaExpand = useCallback((sectionId) => {
    setExpandedFranjaKeys((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const franjaSchedule = useMemo(
    () => groupDailyCadenceBucketByFranjaSchedule(bucket, rutina),
    [bucket, rutina],
  );

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

  const allDoneItems = useMemo(
    () => dedupeCadenceEntries(franjaGroups.flatMap((group) => group.done)),
    [franjaGroups],
  );

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

  const {
    sinHacer,
    ahora,
    luego,
    notToday,
    activeFranjaLabel,
  } = franjaSchedule;

  const hasTodaySchedule = sinHacer.length > 0
    || ahora.length > 0
    || luego.length > 0
    || notToday.length > 0;

  const hasHistoricalReview = isHistorical && (ahora.length > 0 || notToday.length > 0);

  const hasFranjaPending = (group) => group
    && (group.today.length > 0 || group.notToday.length > 0);

  const renderStaticDisplaySection = (section) => {
    const group = section.group;
    if (!hasFranjaPending(group)) return null;

    const groupForRender = { ...group, franjaLabel: section.label };
    const carouselItems = isViewingToday
      ? group.today
      : [...group.today, ...group.notToday];
    const isExpanded = expandedFranjaKeys.has(section.id);

    return (
      <CollapseSectionToggle
        key={section.id}
        expanded={isExpanded}
        onToggle={() => toggleFranjaExpand(section.id)}
        title={section.label}
        count={carouselItems.length > 0 ? carouselItems.length : undefined}
        showDivider={isExpanded}
        contentSx={getCollapseSectionCarouselBodySx(isMobileOrTablet, { expanded: isExpanded })}
      >
        {isExpanded ? (
          renderDayGroup(groupForRender, section.id)
        ) : (
          <RutinaFranjaIconCarousel
            pending={carouselItems}
            franjaKey={section.franjaKey}
            activeFranjaKey={activeFranja}
            rutina={rutina}
            habitsPreferences={habitsPreferences}
            readOnly={readOnly}
            onToggle={handleCarouselToggle}
          />
        )}
      </CollapseSectionToggle>
    );
  };

  return (
    <Box sx={collapseSectionStackSx}>
      {hasHistoricalReview ? (
        <RutinaDayGroupList
          today={ahora}
          notToday={notToday}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          sortable={!readOnly && typeof onReorderSection === 'function'}
          multiSection
          hideDone
          hideGroupHeadings={false}
          useFranjaHeadings
          sectionLabel={RUTINA_HISTORICAL_COPY.unmarked}
          showSectionCounts
          habitsPreferences={habitsPreferences}
          localDataBySection={localDataBySection}
          rowKeyPrefix="historical-cadence"
          onReorderSection={onReorderSection}
          onItemClick={(itemId, event, horario, entrySection) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
          onDoneToggle={(entrySection, itemId, event, horario) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
        />
      ) : isViewingToday && hasTodaySchedule ? (
        <RutinaDayGroupList
          today={ahora}
          sinHacer={sinHacer}
          luego={luego}
          notToday={notToday}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          sortable={!readOnly && typeof onReorderSection === 'function'}
          multiSection
          hideDone
          habitsPreferences={habitsPreferences}
          localDataBySection={localDataBySection}
          useSectionFranjaLayout
          activeFranja={activeFranja}
          activeFranjaLabel={activeFranjaLabel}
          rowKeyPrefix="daily-cadence"
          onReorderSection={onReorderSection}
          onItemClick={(itemId, event, horario, entrySection) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
          onDoneToggle={(entrySection, itemId, event, horario) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
        />
      ) : (
        displaySections.map(renderStaticDisplaySection)
      )}

      {includeDoneSection && (
        <RutinaDoneSection
          items={allDoneItems}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={handleDoneToggle}
          doneHeadingLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : undefined}
          doneTodayLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : undefined}
          doneBeforeLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneBeforeThatDay : undefined}
          defaultExpanded={isHistorical}
          collapsible={isHistorical}
          collapseThreshold={isHistorical ? 3 : 5}
        />
      )}
    </Box>
  );
}
