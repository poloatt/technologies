import React from 'react';
import { TextField } from '@mui/material';
import {
  TareaFormRow,
  tareaFormStandardFieldSx,
  tareaFormFieldInputSx,
} from './tareaFormUi';
import { TareaFormIcons } from './tareaFormIcons';

/** Descripción en fila con icono (estilo Google Calendar). */
export default function TareaFormDescriptionField({
  value,
  onChange,
  placeholder = 'Agregar descripción...',
  showDivider = false,
}) {
  return (
    <TareaFormRow icon={TareaFormIcons.description} showDivider={showDivider}>
      <TextField
        variant="standard"
        fullWidth
        placeholder={placeholder}
        multiline
        minRows={1}
        maxRows={5}
        value={value || ''}
        onChange={onChange}
        sx={{
          ...tareaFormStandardFieldSx,
          '& .MuiInputBase-input': {
            ...tareaFormFieldInputSx,
            color: value ? 'text.primary' : 'text.secondary',
          },
        }}
      />
    </TareaFormRow>
  );
}
