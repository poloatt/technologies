import React from 'react';
import { TextField } from '@mui/material';
import {
  TareaFormRow,
  tareaFormStandardFieldSx,
  tareaFormFieldInputSx,
} from './tareaFormUi';

/** Descripción alineada con el título (sin icono a la izquierda). */
export default function TareaFormDescriptionField({
  value,
  onChange,
  placeholder = 'Agregar descripción...',
  showDivider = false,
}) {
  return (
    <TareaFormRow showDivider={showDivider}>
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
