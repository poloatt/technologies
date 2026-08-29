import React from 'react';
import { Box } from '@mui/material';
import { TareaFormTipoSelector } from '@shared/components/forms/tareaFormUi';

const HABITS_MANAGER_MODE_OPTIONS = [
  { value: 'habits', label: 'Hábitos' },
  { value: 'routines', label: 'Rutinas' },
];

export default function HabitsManagerSidebarHeader({
  mode = 'habits',
  onChange,
  disabled = false,
}) {
  return (
    <Box
      sx={{
        px: 1.5,
        pt: 1.5,
        pb: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        flexShrink: 0,
      }}
    >
      <TareaFormTipoSelector
        value={mode}
        options={HABITS_MANAGER_MODE_OPTIONS}
        onChange={onChange}
        disabled={disabled}
      />
    </Box>
  );
}
