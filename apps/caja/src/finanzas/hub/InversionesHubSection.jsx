import React from 'react';
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
    />
  );
}
