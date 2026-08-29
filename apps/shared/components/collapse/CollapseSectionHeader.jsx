import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  collapseHeaderLayoutSx,
  collapseHeaderRowSx,
  collapseSectionCountSx,
  getCollapseSectionChevronButtonSx,
  getCollapseSectionHeaderSx,
  getCollapseSectionTitleSx,
} from '../../styles/collapseSectionStyles';
import { useResponsive } from '../../hooks';
import CollapseChevron from '../common/CollapseChevron';

/** Cabecera estándar de sección colapsable (mismo aspecto en tareas y rutinas). */
export default function CollapseSectionHeader({
  expanded = true,
  onToggle,
  title,
  count,
  headerLeading = null,
  headerTrailing = null,
  collapsible = true,
  reserveChevronSpace = false,
  isMobile: isMobileProp,
  headerSx,
  onHeaderClick,
  'aria-label': ariaLabel,
}) {
  const { isMobile: isMobileResponsive } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const chevronButtonSx = getCollapseSectionChevronButtonSx(expanded, isMobile);
  const titleSx = getCollapseSectionTitleSx(isMobile);

  const handleClick = (event) => {
    onHeaderClick?.(event);
    if (!event.defaultPrevented && collapsible) {
      onToggle?.(event);
    }
  };

  return (
    <Box
      sx={{
        ...getCollapseSectionHeaderSx(isMobile),
        ...headerSx,
        ...(collapsible ? collapseHeaderRowSx : collapseHeaderLayoutSx),
      }}
      onClick={collapsible || onHeaderClick ? handleClick : undefined}
      role={collapsible ? 'button' : undefined}
      aria-expanded={collapsible ? expanded : undefined}
      aria-label={ariaLabel}
    >
      {collapsible ? (
        <CollapseChevron expanded={expanded} asButton iconButtonSx={chevronButtonSx} />
      ) : reserveChevronSpace ? (
        <CollapseChevron
          expanded={false}
          asButton
          iconButtonSx={{ ...chevronButtonSx, visibility: 'hidden', pointerEvents: 'none' }}
          aria-hidden
          tabIndex={-1}
        />
      ) : null}
      {headerLeading}
      {title != null && (
        <Typography
          variant={isMobile ? 'body2' : 'subtitle2'}
          sx={{
            ...titleSx,
            flex: 1,
            ...(isMobile ? { textTransform: 'uppercase' } : null),
          }}
        >
          {title}
          {count != null && (
            <Box component="span" sx={collapseSectionCountSx}>
              {count}
            </Box>
          )}
        </Typography>
      )}
      {headerTrailing}
    </Box>
  );
}
