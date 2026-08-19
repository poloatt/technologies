import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import {
  TareaFormHeader,
  TaskTipoChips,
  tareaFormTitleFieldSx,
} from '@shared/components/forms/tareaFormUi';
import { PROPIEDAD_TIPOS, getPropiedadAlias } from './propiedadConstants';
import PropiedadEstadoChip from './PropiedadEstadoChip';

export default function PropiedadPanelHeader({
  mode = 'edit',
  data,
  errors = {},
  onTipoChange,
  onAliasChange,
  onClose,
  disableClose = false,
}) {
  const isEdit = mode === 'edit';
  const alias = getPropiedadAlias(data);

  return (
    <TareaFormHeader onClose={disableClose ? undefined : onClose}>
      <TaskTipoChips
        value={data?.tipo || 'CASA'}
        onChange={isEdit ? onTipoChange : () => {}}
        options={PROPIEDAD_TIPOS}
        sx={{
          mb: 1.5,
          pr: 4,
          ...(isEdit ? null : { pointerEvents: 'none', opacity: 0.92 }),
        }}
      />

      {isEdit ? (
        <TextField
          variant="standard"
          fullWidth
          placeholder="Alias de la propiedad"
          value={data?.alias || ''}
          onChange={onAliasChange}
          error={!!errors.alias}
          helperText={errors.alias}
          required
          autoFocus
          sx={{ ...tareaFormTitleFieldSx, pr: 3 }}
        />
      ) : (
        <>
          <Typography
            sx={{
              fontSize: '1.375rem',
              fontWeight: 400,
              lineHeight: 1.35,
              color: 'text.primary',
              pr: 3,
            }}
          >
            {alias}
          </Typography>
          {data?.estado ? (
            <Box sx={{ mt: 1 }}>
              <PropiedadEstadoChip estado={data.estado} />
            </Box>
          ) : null}
        </>
      )}
    </TareaFormHeader>
  );
}
