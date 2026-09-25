import React from 'react';
import { Box } from '@mui/material';

const rowSx = {
  display: 'flex',
  gap: 2,
  flex: 1,
  minHeight: 0,
  width: '100%',
  overflow: 'hidden',
};

const columnSx = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
};

const dividerSx = {
  width: '1px',
  bgcolor: 'divider',
  flexShrink: 0,
  alignSelf: 'stretch',
};

const singleSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  width: '100%',
};

/**
 * Two equal columns with a divider. Used when a list stays visible and a
 * detail card occupies the other half (Foco: Ahora/Luego; Pulso: lista/card).
 *
 * `detailSide` "end" replaces the right column. "start" replaces the left one.
 * Without `detail`, both `start` and `end` stay visible. Without `end`, only
 * `start` is shown until a detail opens on the right.
 */
export default function SplitScreen({
  enabled = true,
  detail = null,
  detailSide = 'end',
  start,
  end = null,
  sx,
}) {
  if (!enabled) {
    return <Box sx={{ ...singleSx, ...sx }}>{start}</Box>;
  }

  const showDetail = detail != null;
  if (!showDetail && end == null) {
    return <Box sx={{ ...singleSx, ...sx }}>{start}</Box>;
  }

  const detailOnStart = showDetail && detailSide === 'start';
  const startNode = detailOnStart ? detail : start;
  const endNode = detailOnStart ? end : (showDetail ? detail : end);

  return (
    <Box sx={{ ...rowSx, ...sx }}>
      <Box sx={columnSx}>{startNode}</Box>
      <Box sx={dividerSx} />
      <Box sx={columnSx}>{endNode}</Box>
    </Box>
  );
}
