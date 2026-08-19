import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { getHubListRowSx, hubLabelSx, hubValueSx } from '../styles/attaHubChipStyles';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { HUB_ROW_LAYOUT } from './hubRowLayout';

export function HubRowSkeleton({ layout = HUB_ROW_LAYOUT }) {
  return (
    <Skeleton
      variant="rounded"
      height={layout.minHeight}
      animation="wave"
      sx={{
        ...getHubSubsectionSx(),
        mb: layout.mb,
        minHeight: layout.minHeight,
      }}
    />
  );
}

/** Fila compacta reutilizable en tarjetas hub Atta. */
export default function HubRow({
  icon = null,
  primary,
  secondary,
  trailing,
  trailingColor = 'text.secondary',
  onClick,
  layout = HUB_ROW_LAYOUT,
}) {
  return (
    <Box
      sx={{
        ...getHubListRowSx(),
        height: 'auto',
        minHeight: layout.minHeight,
        py: layout.py,
        px: layout.px,
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.gap,
        mb: layout.mb,
        cursor: onClick ? 'pointer' : 'default',
        '&:last-child': { mb: 0 },
        ...(onClick ? { '&:hover': { bgcolor: 'action.selected' } } : {}),
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      {icon ? <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box> : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          noWrap
          sx={{ ...hubLabelSx, textTransform: 'none', display: 'block' }}
        >
          {primary}
        </Typography>
        {secondary ? (
          typeof secondary === 'string' ? (
            <Typography
              variant="caption"
              noWrap
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 1.2 }}
            >
              {secondary}
            </Typography>
          ) : (
            <Box sx={{ display: 'block', lineHeight: 1.2, mt: 0.125 }}>{secondary}</Box>
          )
        ) : null}
      </Box>
      {trailing != null && trailing !== '' ? (
        typeof trailing === 'string' || typeof trailing === 'number' ? (
          <Typography
            variant="caption"
            noWrap
            sx={{ ...hubValueSx, color: trailingColor, flexShrink: 0 }}
          >
            {trailing}
          </Typography>
        ) : (
          <Box sx={{ flexShrink: 0 }}>{trailing}</Box>
        )
      ) : null}
    </Box>
  );
}
