import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard, HubItemsPreview } from '../../hub';
import CuentaRow from '../cuentas/CuentaRow';
import { CUENTAS_HUB_PREVIEW_COUNT, normalizeCuenta } from '../cuentas/cuentaConstants';
import { getCuentasPath, resolveFinanzasBranch } from '../finanzasDeepLink';

/** Bloque compacto Cuentas en hubs Finanzas, Propiedades e Inventario. */
export default function CuentasHubSection() {
  const { pathname } = useLocation();
  const branchId = resolveFinanzasBranch(pathname);
  const cuentasPath = getCuentasPath(branchId);
  const isActive = isPathActive(pathname, cuentasPath);

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
      path={cuentasPath}
      isActive={isActive}
    >
      <HubItemsPreview
        loading={loading}
        items={cuentas}
        previewCount={CUENTAS_HUB_PREVIEW_COUNT}
        emptyLabel="Sin cuentas"
        renderRow={(cuenta) => (
          <CuentaRow key={cuenta.id} cuenta={cuenta} branchId={branchId} />
        )}
      />
    </CajaHubSectionCard>
  );
}
