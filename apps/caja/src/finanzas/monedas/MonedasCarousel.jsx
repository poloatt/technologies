import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { monedaCarouselSx, MONEDA_TILE } from './monedaConstants';

export function MonedaTileSkeleton({ count = 3, width = MONEDA_TILE.width, fill = false }) {
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
            width: fill ? 'auto' : (isFullWidth ? '100%' : undefined),
            minWidth: fill ? 180 : (isFullWidth ? 0 : width),
            maxWidth: fill ? '100%' : (isFullWidth ? '100%' : width),
            flex: fill ? '1 1 180px' : (isFullWidth ? '1 1 auto' : `0 0 ${width}px`),
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
