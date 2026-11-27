import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  StoreOutlined,
} from '@mui/icons-material';
import {
  propiedadDetailRowIconSx,
  propiedadDetailPrimaryTextSx,
  propiedadDetailSecondaryTextSx,
  propiedadDetailEmptyTextSx,
} from './propiedadDetailStyles';
import { FONT_SIZE } from '@shared/tipografia';

/** Sección: Ubicación (archivo propio para evitar ciclo ContratosSection ↔ SeccionesPropiedad). */
export default function SeccionUbicacion({ propiedad, variant }) {
  if (!propiedad) return null;

  const isDetail = variant === 'detail';

  const getIconoPropiedad = (tipo) => {
    const iconMap = {
      CASA: HomeIcon,
      DEPARTAMENTO: ApartmentIcon,
      APARTAMENTO: ApartmentIcon,
      LOCAL: StoreOutlined,
    };
    return iconMap[tipo?.toUpperCase()] || HomeIcon;
  };

  if (!propiedad.direccion && !propiedad.ciudad) {
    return isDetail ? (
      <Typography sx={propiedadDetailEmptyTextSx}>Sin dirección registrada</Typography>
    ) : null;
  }

  const IconComponent = getIconoPropiedad(propiedad.tipo);

  const content = (
    <>
      {IconComponent ? (
        React.createElement(IconComponent, { sx: propiedadDetailRowIconSx })
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {propiedad.direccion ? (
          <Typography sx={propiedadDetailPrimaryTextSx} noWrap>
            {propiedad.direccion}
          </Typography>
        ) : null}
        {propiedad.ciudad ? (
          <Typography sx={propiedadDetailSecondaryTextSx} noWrap>
            {propiedad.ciudad}
          </Typography>
        ) : null}
      </Box>
      {propiedad.metrosCuadrados ? (
        <Typography sx={{ ...propiedadDetailSecondaryTextSx, mt: 0, flexShrink: 0 }}>
          {propiedad.metrosCuadrados} m²
        </Typography>
      ) : null}
    </>
  );

  if (isDetail) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, width: '100%' }}>
        {content}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: '32px', px: 1, py: 0.2 }}>
      {IconComponent ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, height: '100%' }}>
          {React.createElement(IconComponent, { sx: { fontSize: '1.3rem', color: 'rgba(255,255,255,0.7)' } })}
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {propiedad.direccion ? (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              fontSize: FONT_SIZE.xs,
              lineHeight: 1,
              m: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: { xs: 120, sm: 200, md: 260 },
            }}
          >
            {propiedad.direccion}
          </Typography>
        ) : null}
        {propiedad.ciudad ? (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 400,
              fontSize: FONT_SIZE.xs,
              color: 'text.secondary',
              lineHeight: 1,
              m: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: { xs: 120, sm: 200, md: 260 },
            }}
          >
            {propiedad.ciudad}
          </Typography>
        ) : null}
      </Box>
      {propiedad.metrosCuadrados ? (
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, fontSize: FONT_SIZE.xs, color: 'text.secondary', textAlign: 'right', minWidth: 60 }}
        >
          {propiedad.metrosCuadrados}m²
        </Typography>
      ) : null}
    </Box>
  );
}

export { SeccionUbicacion };
