import React from 'react';
import { Box, Chip } from '@mui/material';
import {
  rutinaStackRowSx,
  rutinaStackRowInlineSx,
  rutinaStackRowCompactSx,
  rutinaStackRowWrapSx,
  rutinaStackRowWrapCompactSx,
  rutinaStackRowHeaderSx,
  rutinaChainChipSx,
} from '@shared/styles/rutinaPageStyles';

/**
 * Fila horizontal compartida para hábitos apilados en listas de rutina.
 * @param {'inline' | 'compact' | 'card'} variant
 */
export default function RoutineStackRow({
  chainId,
  chainLabel = null,
  rowKeyPrefix = '',
  variant = 'inline',
  children,
}) {
  if (!children) return null;

  const isCard = variant === 'card';
  const isCompact = variant === 'compact';
  const wrapSx = isCompact ? rutinaStackRowWrapCompactSx : rutinaStackRowWrapSx;
  const rowSx = isCompact
    ? rutinaStackRowCompactSx
    : (isCard ? rutinaStackRowSx : rutinaStackRowInlineSx);

  return (
    <Box
      sx={wrapSx}
      data-habit-stack={chainId}
      id={rowKeyPrefix ? `habit-stack-row-${rowKeyPrefix}-${chainId}` : `habit-stack-row-${chainId}`}
    >
      {isCard && chainLabel && (
        <Box sx={rutinaStackRowHeaderSx}>
          <Chip size="small" label={chainLabel} sx={rutinaChainChipSx} />
        </Box>
      )}
      <Box sx={rowSx}>
        {children}
      </Box>
    </Box>
  );
}
