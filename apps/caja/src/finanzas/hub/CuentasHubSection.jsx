import React, { useMemo } from 'react';
import { useAPI } from '@shared/hooks/useAPI';
import { CajaHubSectionCard, HubItemsPreview } from '../../hub';
import CuentaRow from '../cuentas/CuentaRow';
import { CUENTAS_HUB_PREVIEW_COUNT, normalizeCuenta } from '../cuentas/cuentaConstants';
import { useCajaSetup } from '../../atta/useCajaSetup';

/** Bloque compacto Cuentas en hubs Finanzas, Propiedades e Inventario. */
export default function CuentasHubSection() {
  const { setupId, openSetup } = useCajaSetup();
  const isActive = setupId === 'cuentas';

  const { data, loading } = useAPI('/api/cuentas', {
    enableCache: true,
    cacheDuration: 60000,
  });

  const cuentas = useMemo(() => {
    const docs = data?.docs ?? (Array.isArray(data) ? data : []);
    return docs.map(normalizeCuenta);
  }, [data]);

  return (
    <CajaHubSectionCard
      title="Cuentas"
      iconKey="accountBalance"
      onTitleClick={() => openSetup('cuentas')}
      isActive={isActive}
    >
      <HubItemsPreview
        loading={loading}
        items={cuentas}
        previewCount={CUENTAS_HUB_PREVIEW_COUNT}
        emptyLabel="Sin cuentas"
        renderRow={(cuenta) => (
          <CuentaRow key={cuenta.id} cuenta={cuenta} />
        )}
      />
    </CajaHubSectionCard>
  );
}
