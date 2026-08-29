import React from 'react';
import { Typography } from '@mui/material';
import { taskFormTipoFloatingLabelSx } from '@shared/components/forms/tareaFormTokens';

const LABEL_INSET_SX = {
  none: {},
  pill: { pl: 1.25 },
  tab: { pl: 1.5 },
};

/** Etiqueta flotante pequeña sobre bloques del formulario de hábito. */
export default function HabitFormSectionLabel({
  children,
  inset = 'none',
  sx,
}) {
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{
        ...taskFormTipoFloatingLabelSx,
        display: 'block',
        mb: 0.25,
        color: 'text.secondary',
        ...LABEL_INSET_SX[inset],
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
