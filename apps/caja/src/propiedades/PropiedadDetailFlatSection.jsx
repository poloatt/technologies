import React from 'react';
import { Box } from '@mui/material';
import { TareaFormRow, TareaFormSectionLabel } from '@shared/components/forms/tareaFormUi';

/** Bloque de detalle siempre visible (sin collapse), estilo Google Calendar. */
export default function PropiedadDetailFlatSection({
  icon,
  title,
  children,
  showDivider = true,
}) {
  return (
    <TareaFormRow icon={icon} showDivider={showDivider} align="flex-start">
      <Box sx={{ width: '100%', minWidth: 0 }}>
        <TareaFormSectionLabel>{title}</TareaFormSectionLabel>
        {children}
      </Box>
    </TareaFormRow>
  );
}
