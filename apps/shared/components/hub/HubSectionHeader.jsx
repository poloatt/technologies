import React from 'react';
import { Box, CardActionArea, Typography } from '@mui/material';
import { ChevronRightOutlined } from '@mui/icons-material';
import { DynamicIcon } from '../common/DynamicIcon';
import {
  HUB_SECTION,
  hubSectionHeaderSx,
  hubSectionTitleSx,
  hubHeaderIconSx,
  hubHeaderSlotButtonSx,
} from '../../styles/hubSectionStyles';

/** Cabecera tintada de sección hub. Opcionalmente navegable vía onTitleClick o path externo. */
export default function HubSectionHeader({
  title,
  onTitleClick,
  iconKey,
  isActive = false,
  headerSx,
  action = null,
}) {
  const titleRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {iconKey ? (
        <DynamicIcon iconKey={iconKey} size="small" sx={hubHeaderIconSx} />
      ) : null}
      <Typography variant="body2" sx={{ ...hubSectionTitleSx, flex: '0 1 auto' }}>
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

  if (action) {
    return (
      <Box
        sx={{
          ...mergedHeaderSx,
          position: 'relative',
          width: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {onTitleClick ? (
          <CardActionArea
            onClick={onTitleClick}
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: HUB_SECTION.headerHeight,
              minHeight: HUB_SECTION.headerHeight,
              maxHeight: HUB_SECTION.headerHeight,
            }}
          >
            {titleRow}
          </CardActionArea>
        ) : (
          titleRow
        )}
        <Box
          sx={{
            position: 'absolute',
            right: 0.5,
            top: 0,
            bottom: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            '& button': hubHeaderSlotButtonSx,
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {action}
        </Box>
      </Box>
    );
  }

  if (onTitleClick) {
    return (
      <CardActionArea onClick={onTitleClick} sx={mergedHeaderSx}>
        {titleRow}
      </CardActionArea>
    );
  }

  return <Box sx={mergedHeaderSx}>{titleRow}</Box>;
}
