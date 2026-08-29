import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { getDefaultSelectedCadenceBucket } from '@shared/habits';
import RutinaCadenceNav from './RutinaCadenceNav';
import RutinaCadenceDetailPanel from './RutinaCadenceDetailPanel';
import useRutinaCadenceBucketController from '../../hooks/useRutinaCadenceBucketController';

/** Desktop: nav lateral por bucket + panel de detalle (paridad con RutinaDesktopLayout). */
export default function RutinaCadenceDesktopLayout({
  rutina,
  readOnly = false,
}) {
  const {
    habits,
    customSections,
    habitPrefs,
    localDataBySection,
    cadenceBuckets,
    handleItemClick,
  } = useRutinaCadenceBucketController({ rutina, readOnly });

  const [selectedBucket, setSelectedBucket] = useState(() =>
    getDefaultSelectedCadenceBucket(cadenceBuckets),
  );

  useEffect(() => {
    setSelectedBucket(getDefaultSelectedCadenceBucket(cadenceBuckets));
  }, [rutina?._id, cadenceBuckets]);

  if (cadenceBuckets.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', width: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          No hay hábitos activos para mostrar
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        width: '100%',
        minHeight: 0,
        alignItems: 'flex-start',
      }}
    >
      <RutinaCadenceNav
        rutina={rutina}
        habits={habits}
        habitsPreferences={habitPrefs}
        customSections={customSections}
        localDataBySection={localDataBySection}
        selectedBucket={selectedBucket}
        onSelectBucket={setSelectedBucket}
      />
      <RutinaCadenceDetailPanel
        bucketId={selectedBucket}
        rutina={rutina}
        habits={habits}
        habitsPreferences={habitPrefs}
        customSections={customSections}
        readOnly={readOnly}
        localDataBySection={localDataBySection}
        onItemClick={handleItemClick}
      />
    </Box>
  );
}
