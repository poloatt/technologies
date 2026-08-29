import React from 'react';
import { Box, TextField } from '@mui/material';
import { TareaFormHeaderTitleRow } from './tareaFormLayout';
import { TareaFormPillSelect } from './tareaFormControls';
import { TASK_FORM_ROW_GAP, tareaFormTitleFieldSx } from './tareaFormTokens';
import HabitIconPicker from './HabitIconPicker';

const HABIT_TITLE_LEADING_WIDTH = 40;

/**
 * Título de hábito con selector de icono a la izquierda (estilo Google Calendar).
 * Opcionalmente incluye el selector de grupo debajo, alineado al texto del título.
 */
export default function HabitFormTitleField({
  value,
  onChange,
  icon,
  onIconChange,
  placeholder = 'Nombre del hábito',
  error = false,
  helperText,
  iconError = false,
  required = false,
  autoFocus = false,
  inputRef,
  onKeyDown,
  onBlur,
  disabled = false,
  action = null,
  sx,
  section,
  onSectionChange,
  sectionOptions = [],
  sectionError,
  showSection = false,
  sectionEmptyLabel = 'Seleccionar grupo',
  onCreateSection,
  createSectionLabel = 'Nuevo grupo',
  sectionTrailing = null,
}) {
  return (
    <Box>
      <TareaFormHeaderTitleRow
        action={action}
        leading={(
          <HabitIconPicker
            variant="title"
            value={icon}
            onChange={onIconChange}
            error={iconError}
            ariaLabel="Cambiar icono del hábito"
          />
        )}
      >
        <TextField
          variant="standard"
          fullWidth
          placeholder={placeholder}
          value={value || ''}
          onChange={onChange}
          error={error}
          helperText={helperText}
          required={required}
          autoFocus={autoFocus}
          inputRef={inputRef}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          disabled={disabled}
          sx={{ flex: 1, minWidth: 0, ...tareaFormTitleFieldSx, ...sx }}
        />
      </TareaFormHeaderTitleRow>

      {showSection && (
        <Box
          sx={{
            mt: 1,
            pl: (theme) => `calc(${HABIT_TITLE_LEADING_WIDTH}px + ${theme.spacing(TASK_FORM_ROW_GAP)})`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            maxWidth: '100%',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 360 }}>
            <TareaFormPillSelect
              value={section}
              onChange={(e) => onSectionChange?.(e.target.value)}
              options={sectionOptions}
              emptyLabel={sectionEmptyLabel}
              error={sectionError}
              onCreate={onCreateSection}
              createLabel={createSectionLabel}
            />
          </Box>
          {sectionTrailing}
        </Box>
      )}
    </Box>
  );
}
