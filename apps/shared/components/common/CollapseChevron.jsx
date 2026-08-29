import React from 'react';
import { Box, IconButton } from '@mui/material';
import { KeyboardArrowDown as CollapseArrowIcon } from '@mui/icons-material';
import {
  collapseChevronButtonSx,
  collapseChevronSx,
} from '../../styles/collapseSectionStyles';

/**
 * Chevron estándar de secciones colapsables (mismo patrón que TaskGroupSection).
 */
export default function CollapseChevron({
  expanded,
  asButton = false,
  fontSize = 'small',
  sx,
  iconButtonSx,
  onClick,
  ...props
}) {
  if (asButton) {
    const isDecorative = !onClick;
    return (
      <IconButton
        size="small"
        onClick={onClick}
        tabIndex={isDecorative ? -1 : undefined}
        aria-hidden={isDecorative ? true : undefined}
        sx={{ ...collapseChevronButtonSx(expanded), ...iconButtonSx }}
        {...props}
      >
        <CollapseArrowIcon fontSize={fontSize} />
      </IconButton>
    );
  }

  return (
    <Box
      component="span"
      sx={{ ...collapseChevronSx(expanded), ...sx }}
      {...props}
    >
      <CollapseArrowIcon fontSize={fontSize} />
    </Box>
  );
}
