import React from 'react';
import { Typography } from '@mui/material';
import { taskFormTipoFloatingLabelSx } from '@shared/components/forms/tareaFormTokens';

/** Etiqueta flotante pequeña sobre bloques del formulario de hábito. */
export default function HabitFormSectionLabel({ children }) {
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{
        ...taskFormTipoFloatingLabelSx,
        display: 'block',
        mb: 0.25,
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}
