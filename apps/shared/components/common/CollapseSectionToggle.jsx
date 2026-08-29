import React from 'react';
import { Box, Paper } from '@mui/material';
import { getCollapseSectionContentSx, getCollapseSectionShellSx } from '../../styles/collapseSectionStyles';
import { useResponsive } from '../../hooks';
import CollapseSectionHeader from '../collapse/CollapseSectionHeader';

/**
 * Sección con cabecera colapsable y contenido siempre visible debajo.
 * Mismo shell/cabecera que TaskGroupSection (p. ej. SIN HACER, HECHO).
 */
export default function CollapseSectionToggle({
  expanded,
  onToggle,
  title,
  count,
  headerLeading = null,
  headerTrailing = null,
  children = null,
  shellSx,
  contentSx,
  headerSx,
  showDivider = true,
  isMobile: isMobileProp,
  'aria-label': ariaLabel,
}) {
  const { isMobile: isMobileResponsive } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const bodySx = { ...getCollapseSectionContentSx(isMobile), ...contentSx };

  return (
    <Paper
      elevation={0}
      sx={{
        ...getCollapseSectionShellSx(isMobile),
        ...shellSx,
      }}
    >
      <Box
        sx={{
          borderBottom: showDivider && expanded ? 1 : 0,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <CollapseSectionHeader
          expanded={expanded}
          onToggle={onToggle}
          title={title}
          count={count}
          headerLeading={headerLeading}
          headerTrailing={headerTrailing}
          headerSx={headerSx}
          isMobile={isMobile}
          aria-label={ariaLabel}
        />
      </Box>
      {children ? (
        <Box sx={bodySx}>{children}</Box>
      ) : null}
    </Paper>
  );
}
