import React from 'react';
import { Typography } from '@mui/material';
import { TrendingUpOutlined } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';

const INVERSIONES_PATH = '/finanzas/inversiones';

export default function InversionesHubSection() {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, INVERSIONES_PATH);

  return (
    <CajaHubSectionCard
      title="Inversiones"
      iconKey="inversiones"
      path={INVERSIONES_PATH}
      isActive={isActive}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 0.125, display: 'flex', alignItems: 'center', gap: 0.75 }}
      >
        <TrendingUpOutlined sx={{ fontSize: 16, opacity: 0.7 }} />
        Próximamente: portafolios y rendimiento
      </Typography>
    </CajaHubSectionCard>
  );
}
