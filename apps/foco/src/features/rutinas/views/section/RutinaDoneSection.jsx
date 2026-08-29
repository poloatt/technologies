import React from 'react';
import { Box, Typography } from '@mui/material';
import { RUTINA_DAY_GROUP_COPY } from '@shared/copy/agendaTerminology';
import {
  rutinaDoneSectionDividerSx,
  rutinaDoneSectionHeadingSx,
} from '@shared/styles/rutinaPageStyles';
import RutinaDoneCarousel from './RutinaDoneCarousel';

/** Sector Hecho con separador minimalista y carrusel de iconos alineado a la izquierda en vista Grupo. */
export default function RutinaDoneSection({
  items = [],
  rutina,
  habitsPreferences = {},
  readOnly = false,
  onToggle,
  showDivider = true,
  alignIconsLeft = false,
}) {
  if (!items.length) return null;

  return (
    <Box sx={showDivider ? rutinaDoneSectionDividerSx : { pt: 0.25 }}>
      <Typography variant="caption" sx={rutinaDoneSectionHeadingSx}>
        {RUTINA_DAY_GROUP_COPY.done}
      </Typography>
      <RutinaDoneCarousel
        items={items}
        rutina={rutina}
        habitsPreferences={habitsPreferences}
        readOnly={readOnly}
        onToggle={onToggle}
        centerWhenFits={alignIconsLeft ? false : undefined}
      />
    </Box>
  );
}
