import React, { useMemo, useState, useCallback } from 'react';

import { Box, Typography } from '@mui/material';
import CollapseSectionToggle from '@shared/components/common/CollapseSectionToggle';
import {
  collapseSectionStackSx,
  getCollapseSectionCarouselBodySx,
} from '@shared/styles/collapseSectionStyles';
import useResponsive from '@shared/hooks/useResponsive';
import { useRutinas } from '@shared/context';

import {
  groupDailyCadenceByFranja,
  groupDailyCadenceBucketByFranjaSchedule,
  buildRutinaGlobalDoneItems,
  resolveActiveDailyFranja,
  isViewingRutinaToday,
  buildDailyCadenceDisplaySections,
  dedupeCadenceEntries,
} from '@shared/habits';

import { getTimeOfDayLabel } from '@shared/utils/timeOfDayUtils';

import { DAILY_CADENCE_SECTION_COPY, RUTINA_HISTORICAL_COPY, RUTINA_DONE_GROUP_COPY } from '@shared/copy/agendaTerminology';

import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';

import RutinaDayGroupList from '../section/RutinaDayGroupList';

import RutinaFranjaIconCarousel from './RutinaFranjaIconCarousel';

import RutinaDoneSection from '../section/RutinaDoneSection';

import HabitFormSectionLabel from '@shared/components/habits/HabitFormSectionLabel';

/**
 * Bucket Diario en vista cadencia:
 * Hoy → Ahora (franjas atrasadas + activa, stacks por rutina) / Luego
 * (franjas futuras + días semanales como subsecciones floating).
 * Otros días → franjas con etiquetas floating (Mañana, Tarde, Noche), extendidas.
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
  luegoWeekdayGroups = [],
  hideNotToday = false,
}) {
  const { rutinas } = useRutinas();
  const { isMobileOrTablet } = useResponsive();
  const isViewingToday = useMemo(() => isViewingRutinaToday(rutina), [rutina]);
  const isHistorical = useMemo(
    () => rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical',
    [rutina],
  );
  const isFuturePreview = useMemo(
    () => Boolean(rutina?.isPreview)
      || (rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'future'),
    [rutina],
  );
  const isToday = useMemo(
    () => rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'today',
    [rutina],
  );
  const doneSectionCollapsible = isHistorical || isToday;
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
    () => groupDailyCadenceBucketByFranjaSchedule(bucket, rutina, rutinas),
    [bucket, rutina, rutinas],
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
    () => buildRutinaGlobalDoneItems([bucket].filter(Boolean), rutina),
    [bucket, rutina],
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
      hideNotToday={hideNotToday}
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
    || notToday.length > 0
    || (luegoWeekdayGroups || []).some((group) => (group?.pending || []).length > 0);

  const historicalUnmarkedItems = useMemo(
    () => dedupeCadenceEntries(ahora),
    [ahora],
  );

  const hasHistoricalReview = isHistorical && historicalUnmarkedItems.length > 0;

  const futureFranjaGroups = useMemo(
    () => franjaGroups
      .filter((group) => group.today.length > 0 || (!hideNotToday && group.notToday.length > 0))
      .map((group) => ({
        ...group,
        pending: hideNotToday ? group.today : [...group.today, ...group.notToday],
      })),
    [franjaGroups, hideNotToday],
  );

  const hasFranjaPending = (group) => group
    && (group.today.length > 0 || group.notToday.length > 0);

  const renderFutureFranjaGroup = (group) => (
    <Box key={group.franjaKey}>
      <HabitFormSectionLabel inset="pill">{group.franjaLabel}</HabitFormSectionLabel>
      <RutinaDayGroupList
        today={group.pending}
        rutina={rutina}
        habits={habits}
        readOnly={readOnly}
        sortable={!readOnly && typeof onReorderSection === 'function'}
        multiSection
        hideDone
        hideGroupHeadings
        habitsPreferences={habitsPreferences}
        localDataBySection={localDataBySection}
        rowKeyPrefix={`future-${group.franjaKey}`}
        onReorderSection={onReorderSection}
        onItemClick={(itemId, event, horario, entrySection) => {
          onItemClick(entrySection, itemId, event, horario);
        }}
        onDoneToggle={(entrySection, itemId, event, horario) => {
          onItemClick(entrySection, itemId, event, horario);
        }}
      />
    </Box>
  );

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
          today={historicalUnmarkedItems}
          rutina={rutina}
          habits={habits}
          readOnly={readOnly}
          sortable={!readOnly && typeof onReorderSection === 'function'}
          multiSection
          hideDone
          hideGroupHeadings
          useFranjaHeadings
          sectionLabel={RUTINA_HISTORICAL_COPY.unmarked}
          showSectionCounts
          expandableCarousels
          defaultExpandedCarouselKeys={['today']}
          activeFranja={activeFranja}
          habitsPreferences={habitsPreferences}
          localDataBySection={localDataBySection}
          rowKeyPrefix="historical-unmarked"
          onReorderSection={onReorderSection}
          onItemClick={(itemId, event, horario, entrySection) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
          onDoneToggle={(entrySection, itemId, event, horario) => {
            onItemClick(entrySection, itemId, event, horario);
          }}
        />
      ) : isFuturePreview && futureFranjaGroups.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {futureFranjaGroups.map(renderFutureFranjaGroup)}
        </Box>
      ) : isViewingToday && hasTodaySchedule ? (
        <RutinaDayGroupList
          today={ahora}
          sinHacer={sinHacer}
          luego={luego}
          luegoWeekdayGroups={luegoWeekdayGroups}
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
          hideNotToday={hideNotToday}
        />
      ) : (
        displaySections.map(renderStaticDisplaySection)
      )}

      {includeDoneSection && allDoneItems.length > 0 && (
        <RutinaDoneSection
          items={allDoneItems}
          rutina={rutina}
          habitsPreferences={habitsPreferences}
          readOnly={readOnly}
          onToggle={handleDoneToggle}
          doneHeadingLabel={
            isHistorical
              ? RUTINA_HISTORICAL_COPY.doneThatDay
              : isToday
                ? RUTINA_DONE_GROUP_COPY.doneToday
                : undefined
          }
          doneTodayLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : RUTINA_DONE_GROUP_COPY.doneToday}
          doneBeforeLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneBeforeThatDay : RUTINA_DONE_GROUP_COPY.doneBefore}
          defaultExpanded={false}
          collapsible={doneSectionCollapsible}
          collapsePreviewMode={doneSectionCollapsible ? 'carousel' : 'hide'}
          collapseThreshold={doneSectionCollapsible ? 0 : 5}
          habits={habits}
        />
      )}
    </Box>
  );
}
