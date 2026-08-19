import React, { useMemo } from 'react';
import { Box, Collapse, Skeleton, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard, HubExpandFooter, useHubPreviewSlice } from '../../hub';
import { MonedasCarousel } from '../../finanzas/monedas';
import { HabitacionTileSkeleton } from './HabitacionTile';
import PropiedadHubBlock from './PropiedadHubBlock';
import { PROPIEDADES_HUB_PROPIEDAD_PREVIEW_COUNT } from './propiedadesHubConstants';
import { normalizeDocId } from './propiedadesHubUtils';

const PATH = '/propiedades';

function PropiedadesHubSkeleton({ showHabitaciones = true }) {
  if (!showHabitaciones) {
    return (
      <Skeleton height={36} animation="wave" sx={{ borderRadius: 1.5, bgcolor: 'action.hover' }} />
    );
  }

  return (
    <Box>
      <Skeleton height={36} animation="wave" sx={{ borderRadius: 1.5, bgcolor: 'action.hover', mb: 1 }} />
      <MonedasCarousel>
        <HabitacionTileSkeleton />
        <HabitacionTileSkeleton />
        <HabitacionTileSkeleton />
      </MonedasCarousel>
    </Box>
  );
}

export default function PropiedadesHubSection({ showHabitaciones = true }) {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, PATH);

  const { data, loading } = useAPI('/api/propiedades', {
    enableCache: true,
    cacheDuration: 60000,
    params: { withRelated: 'true', limit: 50 },
  });

  const propiedades = useMemo(() => {
    const docs = data?.docs ?? (Array.isArray(data) ? data : []);
    return docs.map((p) => ({
      ...p,
      id: normalizeDocId(p),
      habitaciones: (p.habitaciones || []).map((h) => ({ ...h, id: normalizeDocId(h) })),
    }));
  }, [data]);

  const { expanded, setExpanded, preview, rest, hasMore } = useHubPreviewSlice(
    propiedades,
    PROPIEDADES_HUB_PROPIEDAD_PREVIEW_COUNT,
  );

  return (
    <CajaHubSectionCard title="Propiedades" iconKey="apartment" path={PATH} isActive={isActive}>
      {loading ? (
        <PropiedadesHubSkeleton showHabitaciones={showHabitaciones} />
      ) : propiedades.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', px: 0.25 }}>
          Sin propiedades
        </Typography>
      ) : (
        <>
          {preview.map((propiedad, index) => (
            <PropiedadHubBlock
              key={propiedad.id}
              propiedad={propiedad}
              isLast={!hasMore && index === preview.length - 1}
              showHabitaciones={showHabitaciones}
            />
          ))}
          {hasMore && (
            <>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box>
                  {rest.map((propiedad, index) => (
                    <PropiedadHubBlock
                      key={propiedad.id}
                      propiedad={propiedad}
                      isLast={index === rest.length - 1}
                      showHabitaciones={showHabitaciones}
                    />
                  ))}
                </Box>
              </Collapse>
              <HubExpandFooter
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                restCount={rest.length}
              />
            </>
          )}
        </>
      )}
    </CajaHubSectionCard>
  );
}
