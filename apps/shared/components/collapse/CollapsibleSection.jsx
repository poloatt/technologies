import React from 'react';
import { Box, Collapse, Paper } from '@mui/material';
import { getTaskSurfaceTokens } from '../../styles/taskListStyles';
import {
  collapsePanelProps,
  getCollapseSectionContentSx,
  getCollapseSectionShellSx,
} from '../../styles/collapseSectionStyles';
import { useResponsive } from '../../hooks';
import CollapseSectionHeader from './CollapseSectionHeader';

/**
 * Sección colapsable compartida (tareas HOY/MAÑANA, rutinas por grupo, etc.).
 * Unifica chevron, hover, borde inferior y animación opcional.
 */
export default function CollapsibleSection({
  title,
  count,
  isMobile: isMobileProp,
  children,
  shellSx,
  headerSx,
  contentSx,
  bodySx,
  collapsible = false,
  expanded = true,
  onToggle,
  chevronPosition = 'start',
  animated = false,
  withShadow = true,
  headerContent = null,
  headerLeading = null,
  headerTrailing = null,
  onHeaderClick,
}) {
  const { isMobile: isMobileResponsive, theme } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const { layoutBg } = getTaskSurfaceTokens(theme);
  const isExpanded = collapsible ? expanded : true;
  const sectionBodySx = { ...getCollapseSectionContentSx(isMobile), ...bodySx, ...contentSx };

  const shellStyles = {
    ...getCollapseSectionShellSx(isMobile, { withShadow }),
    ...shellSx,
  };

  const Shell = withShadow ? Paper : Box;
  const shellProps = withShadow ? { elevation: 0, sx: shellStyles } : { sx: shellStyles };

  const defaultHeader = (
    <CollapseSectionHeader
      expanded={isExpanded}
      onToggle={onToggle}
      title={title}
      count={count}
      headerLeading={headerLeading}
      headerTrailing={headerTrailing}
      collapsible={collapsible}
      isMobile={isMobile}
      headerSx={headerSx}
      onHeaderClick={onHeaderClick}
    />
  );

  return (
    <Shell {...shellProps}>
      <Box
        sx={{
          borderBottom: isExpanded ? 1 : 0,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {headerContent ?? defaultHeader}
      </Box>
      {animated ? (
        <Collapse in={isExpanded} {...collapsePanelProps}>
          <Box sx={{ bgcolor: layoutBg, ...sectionBodySx }}>{children}</Box>
        </Collapse>
      ) : (
        isExpanded && (
          <Box sx={{ bgcolor: layoutBg, ...sectionBodySx }}>{children}</Box>
        )
      )}
    </Shell>
  );
}
