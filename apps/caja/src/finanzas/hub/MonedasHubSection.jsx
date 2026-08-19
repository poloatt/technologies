import React, { useMemo } from 'react';
import { Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import MonedaTile from '../monedas/MonedaTile';
import MonedasCarousel, { MonedaTileSkeleton } from '../monedas/MonedasCarousel';
import { sortMonedasByOrden } from '../monedas/monedaSortUtils';
import { monedaDetailPath } from '../finanzasDeepLink';

const MONEDAS_PATH = '/finanzas/monedas';

/** Bloque compacto Monedas en el hub Finanzas. */
export default function MonedasHubSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, MONEDAS_PATH);
  const { data, loading } = useAPI('/api/monedas', {
    enableCache: true,
    cacheDuration: 60000,
    params: { sort: 'orden', limit: 200 },
  });

  const monedas = useMemo(() => {
    const docs = data?.docs ?? (Array.isArray(data) ? data : []);
    return sortMonedasByOrden(docs.filter((m) => m.activa !== false));
  }, [data]);

  return (
    <CajaHubSectionCard
      title="Monedas"
      iconKey="currency"
      path={MONEDAS_PATH}
      isActive={isActive}
    >
      {loading ? (
        <MonedasCarousel>
          <MonedaTileSkeleton />
        </MonedasCarousel>
      ) : monedas.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.125 }}>
          Sin monedas
        </Typography>
      ) : (
        <MonedasCarousel>
          {monedas.map((moneda) => (
            <MonedaTile
              key={moneda.id || moneda._id}
              moneda={moneda}
              variant="compact"
              onSelect={(id) => navigate(monedaDetailPath(id))}
            />
          ))}
        </MonedasCarousel>
      )}
    </CajaHubSectionCard>
  );
}
