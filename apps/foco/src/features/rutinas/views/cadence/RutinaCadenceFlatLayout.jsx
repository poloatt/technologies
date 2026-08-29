import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  groupDailyCadenceByFranja,
  groupWeeklyCadenceByWeekday,
  dedupeCadenceEntries,
} from '@shared/habits';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import { RUTINA_HISTORICAL_COPY } from '@shared/copy/agendaTerminology';
import { collapseSectionStackSx } from '@shared/styles/collapseSectionStyles';
import RutinaDailyCadenceFranjaLayout from './RutinaDailyCadenceFranjaLayout';
import RutinaWeeklyCadenceDayLayout from './RutinaWeeklyCadenceDayLayout';
import RutinaCadenceBucketList from './RutinaCadenceBucketList';
import RutinaDoneSection from '../section/RutinaDoneSection';
import useRutinaCadenceBucketController from '../../hooks/useRutinaCadenceBucketController';

/** Vista cadencia plana (mobile): Sin hacer/Ahora/Luego → semanal → Hecho colapsado al final. */
export default function RutinaCadenceFlatLayout({
  rutina,
  readOnly = false,
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

  const isHistorical = useMemo(
    () => rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical',
    [rutina?.fecha],
  );

  const mergedDoneItems = useMemo(() => {
    const dailyDone = diarioBucket
      ? groupDailyCadenceByFranja(diarioBucket, rutina).flatMap((group) => group.done)
      : [];
    const weeklyDone = semanalBucket
      ? groupWeeklyCadenceByWeekday(semanalBucket, rutina).flatMap((group) => group.done)
      : [];
    const otherDone = otherBuckets.flatMap((bucket) => bucket.done || []);
    return dedupeCadenceEntries([...dailyDone, ...weeklyDone, ...otherDone]);
  }, [diarioBucket, semanalBucket, otherBuckets, rutina]);

  if (cadenceBuckets.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos activos para mostrar
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={collapseSectionStackSx}>
      {diarioBucket && (
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
        />
      )}

      {semanalBucket && (
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
        />
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
        />
      ))}

      <RutinaDoneSection
        items={mergedDoneItems}
        rutina={rutina}
        habitsPreferences={habitPrefs}
        readOnly={readOnly}
        onToggle={handleDoneToggle}
        collapsible
        collapseThreshold={isHistorical ? 3 : 5}
        defaultExpanded={isHistorical}
        doneHeadingLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : undefined}
        doneTodayLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneThatDay : undefined}
        doneBeforeLabel={isHistorical ? RUTINA_HISTORICAL_COPY.doneBeforeThatDay : undefined}
      />
    </Box>
  );
}
