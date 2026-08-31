import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  buildRutinaGlobalDoneItems,
  buildFlexibleLuegoWeekdayGroups,
  mergeLuegoWeekdayGroups,
  shouldHideFlexibleLuegoProjections,
} from '@shared/habits';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import { RUTINA_FUTURE_PREVIEW_COPY, RUTINA_HISTORICAL_COPY, RUTINA_DONE_GROUP_COPY } from '@shared/copy/agendaTerminology';
import { collapseSectionStackSx } from '@shared/styles/collapseSectionStyles';
import RutinaDailyCadenceFranjaLayout from './RutinaDailyCadenceFranjaLayout';
import RutinaWeeklyCadenceDayLayout, {
  useWeeklyCadenceLuegoGroups,
} from './RutinaWeeklyCadenceDayLayout';
import RutinaCadenceBucketList from './RutinaCadenceBucketList';
import RutinaDoneSection from '../section/RutinaDoneSection';
import useRutinaCadenceBucketController from '../../hooks/useRutinaCadenceBucketController';

/** Vista cadencia plana (mobile): Ahora / Luego (franjas + días semanales) → otros → Hecho. */
export default function RutinaCadenceFlatLayout({
  rutina,
  readOnly = false,
  isPreview = false,
}) {
  const {
    habits,
    habitPrefs,
    localDataBySection,
    cadenceBuckets,
    handleItemClick,
    handleDoneToggle,
    handleReorderSection,
  } = useRutinaCadenceBucketController({ rutina, readOnly });

  const diarioBucket = useMemo(
    () => cadenceBuckets.find((bucket) => bucket.id === 'DIARIO') || null,
    [cadenceBuckets],
  );

  const semanalBucket = useMemo(
    () => cadenceBuckets.find((bucket) => bucket.id === 'SEMANAL') || null,
    [cadenceBuckets],
  );

  const otherBuckets = useMemo(
    () => cadenceBuckets.filter((bucket) => bucket.id !== 'DIARIO' && bucket.id !== 'SEMANAL'),
    [cadenceBuckets],
  );

  const dayMode = useMemo(
    () => (rutina?.fecha ? getRutinaDayMode(rutina.fecha) : 'empty'),
    [rutina?.fecha],
  );

  const isHistorical = dayMode === 'historical';
  const isToday = dayMode === 'today';
  const hideFutureProjections = shouldHideFlexibleLuegoProjections(dayMode);
  const hideNotToday = hideFutureProjections;

  const { pendingWeekdayGroups } = useWeeklyCadenceLuegoGroups(
    hideFutureProjections ? null : semanalBucket,
    rutina,
  );

  const flexibleWeekdayGroups = useMemo(() => {
    if (hideFutureProjections) return [];
    const entries = [
      ...(diarioBucket?.today || []),
      ...(diarioBucket?.items || []),
      ...(semanalBucket?.items || []),
    ];
    return buildFlexibleLuegoWeekdayGroups(entries, rutina);
  }, [diarioBucket, semanalBucket, rutina, hideFutureProjections]);

  const luegoWeekdayGroups = useMemo(
    () => (hideFutureProjections ? [] : mergeLuegoWeekdayGroups(pendingWeekdayGroups, flexibleWeekdayGroups)),
    [pendingWeekdayGroups, flexibleWeekdayGroups, hideFutureProjections],
  );

  const mergedDoneItems = useMemo(
    () => buildRutinaGlobalDoneItems(cadenceBuckets, rutina),
    [cadenceBuckets, rutina],
  );

  if (cadenceBuckets.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {isPreview || dayMode === 'future'
            ? RUTINA_FUTURE_PREVIEW_COPY.emptyBody
            : 'No hay hábitos activos para mostrar'}
        </Typography>
      </Box>
    );
  }

  const showDoneSection = dayMode !== 'future' && !isPreview;

  return (
    <Box sx={collapseSectionStackSx}>
      {diarioBucket ? (
        <RutinaDailyCadenceFranjaLayout
          bucket={diarioBucket}
          rutina={rutina}
          readOnly={readOnly}
          onItemClick={handleItemClick}
          habits={habits}
          habitsPreferences={habitPrefs}
          localDataBySection={localDataBySection}
          includeDoneSection={false}
          useShortFranjaLabels
          onReorderSection={handleReorderSection}
          luegoWeekdayGroups={luegoWeekdayGroups}
          hideNotToday={hideNotToday}
        />
      ) : (
        semanalBucket && (
          <RutinaWeeklyCadenceDayLayout
            bucket={semanalBucket}
            rutina={rutina}
            readOnly={readOnly}
            onItemClick={handleItemClick}
            habits={habits}
            habitsPreferences={habitPrefs}
            localDataBySection={localDataBySection}
            includeDoneSection={false}
            onReorderSection={handleReorderSection}
            luegoWeekdayGroupsExtra={flexibleWeekdayGroups}
            hideNotToday={hideNotToday}
          />
        )
      )}

      {otherBuckets.map((bucket) => (
        <RutinaCadenceBucketList
          key={bucket.id}
          bucket={bucket}
          rutina={rutina}
          readOnly={readOnly}
          sortable
          habits={habits}
          habitsPreferences={habitPrefs}
          localDataBySection={localDataBySection}
          onItemClick={handleItemClick}
          onReorderSection={handleReorderSection}
          hideNotToday={hideNotToday}
          hideDone={showDoneSection || isPreview || dayMode === 'future'}
        />
      ))}

      {showDoneSection && mergedDoneItems.length > 0 && (
      <RutinaDoneSection
        items={mergedDoneItems}
        rutina={rutina}
        habitsPreferences={habitPrefs}
        readOnly={readOnly}
        onToggle={handleDoneToggle}
        collapsible
        collapseThreshold={isHistorical ? 0 : 5}
        defaultExpanded={false}
        collapsePreviewMode={isHistorical ? 'carousel' : 'hide'}
        habits={habits}
        doneHeadingLabel={
          isHistorical
            ? RUTINA_HISTORICAL_COPY.doneThatDay
            : isToday
              ? RUTINA_DONE_GROUP_COPY.doneToday
              : undefined
        }
        doneTodayLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : RUTINA_DONE_GROUP_COPY.doneToday}
        doneBeforeLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneBeforeThatDay : RUTINA_DONE_GROUP_COPY.doneBefore}
      />
      )}
    </Box>
  );
}
