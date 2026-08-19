import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import {
  LocationOnOutlined as LocationIcon,
  SquareFootOutlined as SquareFootIcon,
  NotesOutlined as NotesIcon,
} from '@mui/icons-material';
import {
  TareaFormRow,
  TareaFormPillSelect,
  TareaFormSecondaryLine,
  tareaFormStandardFieldSx,
} from '@shared/components/forms/tareaFormUi';
import TareaFormDescriptionField from '@shared/components/forms/TareaFormDescriptionField';
import { TareaFormIcons } from '@shared/components/forms/tareaFormUi';
import {
  propiedadDetailEmptyTextSx,
  propiedadDetailPrimaryTextSx,
} from './propiedadDetailStyles';
import { getDocumentId } from './propiedadFormUtils';

const fieldSx = {
  ...tareaFormStandardFieldSx,
  '& .MuiInputBase-input': { fontSize: '0.875rem', py: 0.5 },
  '& .MuiInput-underline:before': { borderBottomColor: 'divider' },
};

function resolveCuentaLabel(data, cuentaOptions) {
  const populated = data?.cuenta;
  if (populated && typeof populated === 'object') {
    return `${populated.nombre || 'Sin nombre'} · ${populated.tipo || ''}`.trim();
  }
  const cuentaId = getDocumentId(data?.cuenta);
  const match = cuentaOptions?.find((option) => option.value === cuentaId);
  return match?.label || 'Sin cuenta';
}

export default function PropiedadCoreFields({
  mode = 'edit',
  data,
  errors = {},
  onChange,
  cuentaOptions = [],
  isLoadingCuentas = false,
}) {
  if (mode === 'view') {
    const hasUbicacion = data?.direccion || data?.ciudad || data?.metrosCuadrados;

    return (
      <>
        {data?.descripcion ? (
          <TareaFormRow icon={NotesIcon} showDivider align="flex-start">
            <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
              {data.descripcion}
            </Typography>
          </TareaFormRow>
        ) : null}

        <TareaFormRow icon={TareaFormIcons.folder} showDivider>
          <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
            {resolveCuentaLabel(data, cuentaOptions)}
          </Typography>
        </TareaFormRow>

        <TareaFormRow icon={LocationIcon} showDivider align="flex-start">
          {hasUbicacion ? (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {data.direccion ? (
                <Typography sx={propiedadDetailPrimaryTextSx}>{data.direccion}</Typography>
              ) : null}
              {data.ciudad ? <TareaFormSecondaryLine>{data.ciudad}</TareaFormSecondaryLine> : null}
            </Box>
          ) : (
            <Typography sx={propiedadDetailEmptyTextSx}>Sin dirección registrada</Typography>
          )}
        </TareaFormRow>

        {data?.metrosCuadrados ? (
          <TareaFormRow icon={SquareFootIcon}>
            <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
              {data.metrosCuadrados} m²
            </Typography>
          </TareaFormRow>
        ) : null}
      </>
    );
  }

  return (
    <>
      <TareaFormDescriptionField
        value={data?.descripcion || ''}
        onChange={(event) => onChange('descripcion', event.target.value)}
        placeholder="Agregar descripción..."
        showDivider
      />
      {errors.descripcion ? (
        <Typography variant="caption" color="error" sx={{ display: 'block', px: 4.5, pb: 1 }}>
          {errors.descripcion}
        </Typography>
      ) : null}

      <TareaFormRow icon={TareaFormIcons.folder} showDivider>
        <Box sx={{ width: '100%' }}>
          <TareaFormPillSelect
            value={data?.cuenta || ''}
            onChange={(event) => onChange('cuenta', event.target.value || null)}
            options={cuentaOptions}
            emptyLabel={isLoadingCuentas ? 'Cargando cuentas...' : 'Cuenta'}
            error={errors.cuenta}
          />
        </Box>
      </TareaFormRow>

      <TareaFormRow icon={LocationIcon} showDivider>
        <Box sx={{ width: '100%' }}>
          <TextField
            variant="standard"
            fullWidth
            placeholder="Dirección"
            value={data?.direccion || ''}
            onChange={(event) => onChange('direccion', event.target.value)}
            error={!!errors.direccion}
            helperText={errors.direccion}
            sx={fieldSx}
          />
          <TextField
            variant="standard"
            fullWidth
            placeholder="Ciudad"
            value={data?.ciudad || ''}
            onChange={(event) => onChange('ciudad', event.target.value)}
            error={!!errors.ciudad}
            helperText={errors.ciudad}
            sx={{ ...fieldSx, mt: 1 }}
          />
        </Box>
      </TareaFormRow>

      <TareaFormRow icon={SquareFootIcon}>
        <TextField
          variant="standard"
          fullWidth
          placeholder="Metros cuadrados"
          value={data?.metrosCuadrados || ''}
          onChange={(event) => onChange('metrosCuadrados', event.target.value)}
          error={!!errors.metrosCuadrados}
          helperText={errors.metrosCuadrados}
          inputProps={{ inputMode: 'decimal' }}
          sx={fieldSx}
        />
      </TareaFormRow>
    </>
  );
}
