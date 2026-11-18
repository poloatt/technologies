import React from 'react';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';

const DEUDORES_PATH = '/finanzas/deudores';

export default function DeudoresHubSection() {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, DEUDORES_PATH);

  return (
    <CajaHubSectionCard
      title="Deudores"
      iconKey="personSearch"
      path={DEUDORES_PATH}
      isActive={isActive}
    />
  );
}
