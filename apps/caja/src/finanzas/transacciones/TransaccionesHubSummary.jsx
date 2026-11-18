import TransaccionesFlujoVisual from './TransaccionesFlujoVisual';

/** Vista compacta del flujo para la tarjeta del hub, sin listado ni spark. */
export default function TransaccionesHubSummary() {
  return <TransaccionesFlujoVisual density="compact" />;
}
