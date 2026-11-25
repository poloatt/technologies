import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import TransaccionesHubSummary from '../transacciones/TransaccionesHubSummary';
import LedgerKindFilter from '../transacciones/LedgerKindFilter';
import { FLUJO_TYPE_FILTERS } from '../transacciones/ledgerKindFilters';
import { getTransaccionesPath, resolveFinanzasBranch } from '../finanzasDeepLink';

/** Bloque Transacciones en hubs Finanzas, Propiedades e Inventario. */
export default function TransaccionesHubSection() {
  const { pathname } = useLocation();
  const branchId = resolveFinanzasBranch(pathname);
  const transaccionesPath = getTransaccionesPath(branchId);
  const isActive = isPathActive(pathname, transaccionesPath);
  const [enabledKinds, setEnabledKinds] = useState(null);

  return (
    <CajaHubSectionCard
      title="Transacciones"
      iconKey="moneyBag"
      path={transaccionesPath}
      isActive={isActive}
      action={(
        <LedgerKindFilter
          options={FLUJO_TYPE_FILTERS}
          enabledIds={enabledKinds}
          onChange={setEnabledKinds}
        />
      )}
    >
      <TransaccionesHubSummary enabledKinds={enabledKinds} onKindsChange={setEnabledKinds} />
    </CajaHubSectionCard>
  );
}
