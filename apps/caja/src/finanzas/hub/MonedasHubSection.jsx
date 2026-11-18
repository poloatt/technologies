import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { useResponsive } from '@shared/hooks';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import MonedaTile from '../monedas/MonedaTile';
import MonedasCarousel, { MonedaTileSkeleton } from '../monedas/MonedasCarousel';
import { sortMonedasByOrden } from '../monedas/monedaSortUtils';
import { MONEDA_TILE } from '../monedas/monedaConstants';
import { monedaDetailPath } from '../finanzasDeepLink';

const MONEDAS_PATH = '/finanzas/monedas';

/** Bloque compacto Monedas en el hub Finanzas. */
const hubMonedaRowSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: MONEDA_TILE.gap,
  width: '100%',
  alignItems: 'stretch',
};

export default function MonedasHubSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useResponsive();
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
        isMobile ? (
          <MonedasCarousel>
            <MonedaTileSkeleton />
          </MonedasCarousel>
        ) : (
          <Box sx={hubMonedaRowSx}>
            <MonedaTileSkeleton fill />
          </Box>
        )
      ) : monedas.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.125 }}>
          Sin monedas
        </Typography>
      ) : isMobile ? (
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
      ) : (
        <Box sx={hubMonedaRowSx}>
          {monedas.map((moneda) => (
            <MonedaTile
              key={moneda.id || moneda._id}
              moneda={moneda}
              variant="compact"
              fillRow
              onSelect={(id) => navigate(monedaDetailPath(id))}
            />
          ))}
        </Box>
      )}
    </CajaHubSectionCard>
  );
}
