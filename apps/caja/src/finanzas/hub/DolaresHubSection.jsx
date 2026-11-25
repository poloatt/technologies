import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import DolaresResumen from '../dolares/DolaresResumen';

const DOLARES_PATH = '/finanzas/dolares';

export default function DolaresHubSection() {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, DOLARES_PATH);

  return (
    <CajaHubSectionCard
      title="Dólares"
      iconKey="dolares"
      path={DOLARES_PATH}
      isActive={isActive}
    >
      <DolaresResumen density="compact" />
    </CajaHubSectionCard>
  );
}
