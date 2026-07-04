import React from 'react';
import { Box, Chip, Stack } from '@mui/material';
import {
  TareaFormRow,
  TareaFormSectionLabel,
  tareaFormChipSx,
  tareaFormRowContentGutterSx,
} from './tareaFormUi';
import { TareaFormIcons } from './tareaFormIcons';

export default function TareaFormAttachmentsSection({ archivos = [], onRemove }) {
  if (!archivos.length) return null;

  return (
    <TareaFormRow icon={TareaFormIcons.attach} showDivider={false} align="flex-start">
      <Box sx={tareaFormRowContentGutterSx}>
        <TareaFormSectionLabel sx={{ mb: 0.75 }}>Archivos adjuntos</TareaFormSectionLabel>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {archivos.map((archivo, index) => (
            <Chip
              key={`${archivo.nombre}-${index}`}
              label={archivo.nombre}
              onDelete={() => onRemove?.(index)}
              size="small"
              sx={tareaFormChipSx}
            />
          ))}
        </Stack>
      </Box>
    </TareaFormRow>
  );
}
