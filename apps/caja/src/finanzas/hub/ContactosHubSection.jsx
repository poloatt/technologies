import React from 'react';
import { CajaHubSectionCard } from '../../hub';
import { useCajaSetup } from '../../atta/useCajaSetup';

export default function ContactosHubSection() {
  const { setupId, openSetup } = useCajaSetup();

  return (
    <CajaHubSectionCard
      title="Contactos"
      iconKey="personSearch"
      onTitleClick={() => openSetup('contactos')}
      isActive={setupId === 'contactos'}
    />
  );
}
