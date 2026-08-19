import React, { forwardRef, memo } from 'react';
import { IconButton } from '@mui/material';
import { AddOutlined } from '@mui/icons-material';

/** Tamaño y hover compartidos por botones de toolbar (Foco, Caja, Pulso). */
export const TOOLBAR_ICON_BUTTON_SX = {
  width: { xs: 32, sm: 26 },
  height: { xs: 32, sm: 26 },
  padding: { xs: 0.25, sm: 0.125 },
  minWidth: { xs: 32, sm: 26 },
  minHeight: { xs: 32, sm: 26 },
  '& .MuiSvgIcon-root': {
    fontSize: { xs: '1.1rem', sm: '1.1rem' },
  },
  '&:hover': { backgroundColor: 'action.hover' },
};

function mergeToolbarAddSx(buttonSx = {}, isActive = false) {
  const { '&:hover': hoverOverride, ...rest } = buttonSx;
  return {
    ...TOOLBAR_ICON_BUTTON_SX,
    color: 'primary.main',
    ...(isActive && {
      bgcolor: 'action.selected',
      '&:hover': { bgcolor: 'action.selected' },
    }),
    '&:hover': {
      color: 'primary.main',
      backgroundColor: isActive ? 'action.selected' : 'action.hover',
      ...hoverOverride,
    },
    ...rest,
  };
}

/**
 * Botón «+» de toolbar (mismo aspecto en Foco, Caja y Pulso).
 * forwardRef para uso dentro de MUI Tooltip (HeaderAddButton).
 */
export const ToolbarAddButton = memo(
  forwardRef(function ToolbarAddButton(
    {
      onClick,
      disabled = false,
      isActive = false,
      buttonSx = {},
      'aria-label': ariaLabel = 'Crear',
      ...other
    },
    ref
  ) {
    return (
      <IconButton
        ref={ref}
        size="small"
        {...other}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        sx={mergeToolbarAddSx(buttonSx, isActive)}
      >
        <AddOutlined />
      </IconButton>
    );
  })
);

ToolbarAddButton.isButtonComponent = true;

export default ToolbarAddButton;
