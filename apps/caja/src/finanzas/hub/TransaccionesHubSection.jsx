import { CajaHubSectionCard } from '../../hub';
import TransaccionesHubSummary from '../transacciones/TransaccionesHubSummary';
import { useCajaSetup } from '../../atta/useCajaSetup';

/**
 * Bloque Cuentas del hub. El listado de cada cuenta vive en el cuerpo;
 * cada saldo ($ en cuenta, U$D, reservas, rendimientos) abre su libro.
 * El título abre el popup de Cuentas.
 */
export default function TransaccionesHubSection() {
  const { setupId, openSetup } = useCajaSetup();

  return (
    <CajaHubSectionCard
      title="Cuentas"
      iconKey="accountBalance"
      onTitleClick={() => openSetup('cuentas')}
      isActive={setupId === 'cuentas'}
    >
      <TransaccionesHubSummary />
    </CajaHubSectionCard>
  );
}
