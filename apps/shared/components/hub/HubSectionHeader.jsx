import React from 'react';
import { Box, CardActionArea, Typography } from '@mui/material';
import { ChevronRightOutlined } from '@mui/icons-material';
import { DynamicIcon } from '../common/DynamicIcon';
import {
  hubSectionHeaderSx,
  hubSectionTitleSx,
  hubHeaderIconSx,
} from '../../styles/hubSectionStyles';

/** Cabecera tintada de sección hub. Opcionalmente navegable vía onTitleClick o path externo. */
export default function HubSectionHeader({
  title,
  onTitleClick,
  iconKey,
  isActive = false,
  headerSx,
}) {
  const titleRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {iconKey ? (
        <DynamicIcon iconKey={iconKey} size="small" sx={hubHeaderIconSx} />
      ) : null}
      <Typography variant="body2" sx={hubSectionTitleSx}>
        {title}
      </Typography>
      {onTitleClick ? (
        <ChevronRightOutlined
          sx={{ fontSize: 16, color: isActive ? 'primary.main' : 'text.disabled' }}
        />
      ) : null}
    </Box>
  );

  const mergedHeaderSx = { ...hubSectionHeaderSx, ...headerSx };

  if (onTitleClick) {
    return (
      <CardActionArea onClick={onTitleClick} sx={mergedHeaderSx}>
        {titleRow}
      </CardActionArea>
    );
  }

  return <Box sx={mergedHeaderSx}>{titleRow}</Box>;
}
