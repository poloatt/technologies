import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { taskFormHeaderActionIconSx, taskFormPillIconSx } from '../forms/tareaFormTokens';

const cornerSx = {
  position: 'absolute',
  zIndex: 2,
  ...taskFormHeaderActionIconSx(),
  '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
};

export function FigureBackButton({ onClick, sx }) {
  return (
    <Tooltip title="Cuerpo completo">
      <IconButton
        aria-label="Cuerpo completo"
        onClick={onClick}
        sx={{ ...cornerSx, top: 0, left: 0, ...sx }}
      >
        <ArrowBackOutlinedIcon sx={taskFormPillIconSx} />
      </IconButton>
    </Tooltip>
  );
}

export function FigureHelpButton({
  open = false,
  title,
  onToggle,
  onOpen,
  onClose,
  label = 'Licencia del esqueleto',
  sx,
}) {
  return (
    <Tooltip
      open={open}
      title={title}
      disableFocusListener
      disableHoverListener
      disableTouchListener
      componentsProps={{ tooltip: { sx: { maxWidth: 260, textAlign: 'center' } } }}
    >
      <IconButton
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        sx={{ ...cornerSx, top: 0, right: 0, ...sx }}
      >
        <HelpOutlineIcon sx={taskFormPillIconSx} />
      </IconButton>
    </Tooltip>
  );
}
