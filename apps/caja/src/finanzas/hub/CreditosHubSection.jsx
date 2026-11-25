import React from 'react';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import CreditosResumen from '../creditos/CreditosResumen';

const CREDITOS_PATH = '/finanzas/creditos';

export default function CreditosHubSection() {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, CREDITOS_PATH);

  return (
    <CajaHubSectionCard
      title="Créditos"
      iconKey="creditos"
      path={CREDITOS_PATH}
      isActive={isActive}
    >
      <CreditosResumen density="compact" />
    </CajaHubSectionCard>
  );
}
