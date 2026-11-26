import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import TransaccionesHubSummary from '../transacciones/TransaccionesHubSummary';
import { getTransaccionesPath, resolveFinanzasBranch } from '../finanzasDeepLink';

/**
 * Bloque Transacciones en hubs Finanzas, Propiedades e Inventario.
 * El filtro de tipos está dentro del resumen, junto a la línea de flujo que filtra.
 */
export default function TransaccionesHubSection() {
  const { pathname } = useLocation();
  const branchId = resolveFinanzasBranch(pathname);
  const transaccionesPath = getTransaccionesPath(branchId);
  const isActive = isPathActive(pathname, transaccionesPath);

  return (
    <CajaHubSectionCard
      title="Transacciones"
      iconKey="moneyBag"
      path={transaccionesPath}
      isActive={isActive}
    >
      <TransaccionesHubSummary />
    </CajaHubSectionCard>
  );
}
