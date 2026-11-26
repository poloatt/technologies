import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { hubSectionShellSx } from '../../../styles/hubSectionStyles';
import HubSectionHeader from '../../hub/HubSectionHeader';

/**
 * Cluster de hábitos de una rutina en carrusel.
 * showTitleBar: cabecera de sección hub + marco (Ahora). Si no, iconos planos lado a lado (Luego / Hecho).
 */
export default function RoutineCarouselStackCluster({
  chainId,
  label = null,
  children,
  compact = false,
  showTitleBar = true,
}) {
  if (!children) return null;

  if (!showTitleBar) {
    const cluster = (
      <Box
        data-habit-stack={chainId}
        aria-label={label || undefined}
        sx={{
          display: 'inline-flex',
          flex: '0 0 auto',
          flexShrink: 0,
          alignItems: 'center',
          gap: 0.25,
        }}
      >
        {children}
      </Box>
    );

    if (label) {
      return (
        <Tooltip title={label}>
          {cluster}
        </Tooltip>
      );
    }
    return cluster;
  }

  return (
    <Box
      data-habit-stack={chainId}
      aria-label={label || undefined}
      sx={{
        ...hubSectionShellSx,
        mb: 0,
        display: 'inline-flex',
        flexDirection: 'column',
        flex: '0 0 auto',
        alignItems: 'stretch',
        minWidth: 0,
      }}
    >
      {label ? (
        <HubSectionHeader
          title={label}
          headerSx={compact ? { minHeight: 22, height: 22, maxHeight: 22, px: 1 } : { px: 1 }}
          titleSx={{
            ...(compact ? { fontSize: '0.75rem' } : null),
            maxWidth: 160,
          }}
        />
      ) : null}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          px: 0.35,
          py: 0.3,
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
