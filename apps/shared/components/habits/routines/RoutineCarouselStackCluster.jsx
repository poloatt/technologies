import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Cluster de hábitos de una rutina en carrusel.
 * showTitleBar: barra fina + marco (Ahora). Si no, iconos planos lado a lado (Luego / Hecho).
 */
export default function RoutineCarouselStackCluster({
  chainId,
  label = null,
  children,
  compact = false,
  showTitleBar = true,
}) {
  const theme = useTheme();
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

  const borderColor = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.14 : 0.1);
  const headerBg = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.035);

  return (
    <Box
      data-habit-stack={chainId}
      aria-label={label || undefined}
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        flex: '0 0 auto',
        flexShrink: 0,
        alignItems: 'stretch',
        minWidth: 0,
        border: '1px solid',
        borderColor,
        borderRadius: 1.25,
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.paper, 0.55),
      }}
    >
      {label ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: compact ? 14 : 16,
            px: 0.75,
            py: 0,
            borderBottom: '1px solid',
            borderColor,
            bgcolor: headerBg,
          }}
        >
          <Typography
            component="span"
            variant="caption"
            noWrap
            title={label}
            sx={{
              fontWeight: 650,
              fontSize: compact ? '0.62rem' : '0.68rem',
              lineHeight: 1.15,
              letterSpacing: 0.15,
              color: 'text.secondary',
              maxWidth: 160,
            }}
          >
            {label}
          </Typography>
        </Box>
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
