import React from 'react';
import { Box, Paper } from '@mui/material';
import { getCollapseSectionContentSx, getCollapseSectionShellSx } from '../../styles/collapseSectionStyles';
import { useResponsive } from '../../hooks';
import CollapseSectionHeader from './CollapseSectionHeader';

/** Cabecera estática (sin chevron) con el mismo shell que TaskGroupSection. */
export default function CollapseSectionLabel({
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
}) {
  const { isMobile: isMobileResponsive } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const hasBody = Boolean(children);
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
          borderBottom: showDivider && hasBody ? 1 : 0,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <CollapseSectionHeader
          collapsible={false}
          reserveChevronSpace
          title={title}
          count={count}
          headerLeading={headerLeading}
          headerTrailing={headerTrailing}
          headerSx={headerSx}
          isMobile={isMobile}
        />
      </Box>
      {hasBody ? <Box sx={bodySx}>{children}</Box> : null}
    </Paper>
  );
}
