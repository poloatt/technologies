import TransaccionesFlujoVisual from './TransaccionesFlujoVisual';

/** Vista compacta del flujo para la tarjeta del hub, sin listado ni spark. */
export default function TransaccionesHubSummary({ enabledKinds, onKindsChange }) {
  return (
    <TransaccionesFlujoVisual
      density="compact"
      enabledKinds={enabledKinds}
      onKindsChange={onKindsChange}
    />
  );
}
