import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  rutinaStackRowSx,
  rutinaStackRowInlineSx,
  rutinaStackRowCompactSx,
  rutinaStackRowWrapSx,
  rutinaStackRowWrapCompactSx,
  rutinaStackRowHeaderSx,
  rutinaRoutineChipSx,
} from '@shared/styles/rutinaPageStyles';
import { ROUTINE_CHIP_LABEL } from '@shared/habits';

/**
 * Fila horizontal compartida para hábitos de una rutina en listas de rutina.
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
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {chainLabel}
          </Typography>
          <Chip size="small" label={ROUTINE_CHIP_LABEL} sx={rutinaRoutineChipSx} />
        </Box>
      )}
      <Box sx={rowSx}>
        {children}
      </Box>
    </Box>
  );
}
