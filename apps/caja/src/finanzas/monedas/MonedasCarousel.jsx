import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { monedaCarouselSx, MONEDA_TILE } from './monedaConstants';

export function MonedaTileSkeleton({ count = 3, width = MONEDA_TILE.width }) {
  const isFullWidth = width === '100%';
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={MONEDA_TILE.heightFull}
          animation="wave"
          sx={{
            width: isFullWidth ? '100%' : undefined,
            minWidth: isFullWidth ? 0 : width,
            maxWidth: isFullWidth ? '100%' : width,
            flex: isFullWidth ? '1 1 auto' : `0 0 ${width}px`,
            ...getHubSubsectionSx(),
          }}
        />
      ))}
    </>
  );
}

/** Carrusel horizontal de tiles (hub Finanzas y página Monedas en viewport below md). */
export default function MonedasCarousel({ children, sx = {} }) {
  return (
    <Box sx={{ ...monedaCarouselSx, ...sx }}>
      {children}
    </Box>
  );
}
