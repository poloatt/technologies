import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  rutinaStackRowSx,
  rutinaStackRowInlineSx,
  rutinaStackRowCompactSx,
  rutinaStackRowWrapSx,
  rutinaStackRowWrapCompactSx,
  rutinaRoutineGroupShellSx,
  rutinaRoutineGroupTitleBarSx,
  rutinaRoutineGroupTitleTextSx,
  rutinaRoutineGroupBodySx,
} from '@shared/styles/rutinaPageStyles';

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

  if (isCard) {
    return (
      <Box
        sx={wrapSx}
        data-habit-stack={chainId}
        id={rowKeyPrefix ? `habit-stack-row-${rowKeyPrefix}-${chainId}` : `habit-stack-row-${chainId}`}
      >
        <Box sx={rutinaRoutineGroupShellSx}>
          {chainLabel ? (
            <Box sx={rutinaRoutineGroupTitleBarSx}>
              <Typography
                component="span"
                variant="caption"
                noWrap
                title={chainLabel}
                sx={rutinaRoutineGroupTitleTextSx}
              >
                {chainLabel}
              </Typography>
            </Box>
          ) : null}
          <Box sx={{ ...rutinaRoutineGroupBodySx, ...rowSx }}>
            {children}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={wrapSx}
      data-habit-stack={chainId}
      id={rowKeyPrefix ? `habit-stack-row-${rowKeyPrefix}-${chainId}` : `habit-stack-row-${chainId}`}
    >
      <Box sx={rowSx}>
        {children}
      </Box>
    </Box>
  );
}
