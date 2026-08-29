import React from 'react';
import { Box, IconButton } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { TareaFormTipoSelector } from '@shared/components/forms/tareaFormUi';
import {
  TASK_FORM_PILL_BORDER_RADIUS,
  TASK_FORM_PILL_HEIGHT,
  TASK_FORM_PILL_ICON_SIZE,
  TASK_FORM_PILL_OUTLINE_BORDER,
  TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
  TASK_FORM_PILL_OUTLINED_BG_HOVER,
} from '@shared/components/forms/tareaFormUi';

const HABITS_MANAGER_MODE_OPTIONS = [
  { value: 'habits', label: 'Hábitos' },
  { value: 'routines', label: 'Rutinas' },
];

export default function HabitsManagerSidebarHeader({
  mode = 'habits',
  onChange,
  onAddClick,
  disabled = false,
  edge = 'top',
}) {
  const anchoredBottom = edge === 'bottom';

  return (
    <Box
      sx={{
        px: 1.5,
        pt: anchoredBottom ? 1 : 1.5,
        pb: anchoredBottom ? 1.25 : 1,
        borderBottom: anchoredBottom ? 0 : 1,
        borderTop: anchoredBottom ? 1 : 0,
        borderColor: 'divider',
        bgcolor: 'background.default',
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TareaFormTipoSelector
            value={mode}
            options={HABITS_MANAGER_MODE_OPTIONS}
            onChange={onChange}
            disabled={disabled}
          />
        </Box>
        {typeof onAddClick === 'function' && (
          <IconButton
            size="small"
            onClick={onAddClick}
            disabled={disabled}
            aria-label="Agregar hábito o rutina"
            sx={{
              width: TASK_FORM_PILL_HEIGHT,
              height: TASK_FORM_PILL_HEIGHT,
              flexShrink: 0,
              color: 'text.secondary',
              border: '1px solid',
              borderColor: TASK_FORM_PILL_OUTLINE_BORDER,
              borderRadius: TASK_FORM_PILL_BORDER_RADIUS,
              '&:hover': {
                bgcolor: TASK_FORM_PILL_OUTLINED_BG_HOVER,
                borderColor: TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
                color: 'text.primary',
              },
            }}
          >
            <AddOutlinedIcon sx={{ fontSize: TASK_FORM_PILL_ICON_SIZE }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
