import TransaccionesFlujoVisual from './TransaccionesFlujoVisual';
import EfectivoHubSummary from '../cuentas/EfectivoHubSummary';
import SaldoTotalHubSummary from '../cuentas/SaldoTotalHubSummary';

/**
 * Vista compacta de las cuentas para la tarjeta del hub, sin listado ni spark.
 * Arriba va el saldo total por moneda de todas las cuentas; debajo, cada cuenta.
 */
export default function TransaccionesHubSummary() {
  return (
    <>
      <SaldoTotalHubSummary />
      <TransaccionesFlujoVisual density="compact" />
      <EfectivoHubSummary />
    </>
  );
}
