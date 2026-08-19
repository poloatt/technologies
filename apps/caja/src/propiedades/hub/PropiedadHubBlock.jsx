import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getEstadoColor, getEstadoText } from '@shared/components/common/StatusSystem';
import { MonedasCarousel } from '../../finanzas/monedas';
import TipoPropiedadIcon from '../TipoPropiedadIcon';
import HabitacionTile from './HabitacionTile';
import { getPropiedadEstado } from '@shared/utils/propiedadUtils';
import { getPropiedadLabel } from './propiedadesHubUtils';
import { PROPIEDADES_PATH, propiedadDetailState } from '../propiedadesDeepLink';
import {
  getPropiedadEstadoChipSx,
  getPropiedadHubBlockSx,
  propiedadHubCarouselAreaSx,
  propiedadHubCarouselSx,
  propiedadHubEmptySx,
  propiedadHubHeaderSx,
  propiedadHubIconSx,
  propiedadHubSubtitleSx,
  propiedadHubTitleSx,
} from '../../hub/styles/attaPropiedadHubStyles';

export default function PropiedadHubBlock({ propiedad, isLast = false, showHabitaciones = true }) {
  const navigate = useNavigate();
  const estado = getPropiedadEstado(propiedad);
  const habitaciones = propiedad.habitaciones || [];
  const estadoColor = getEstadoColor(estado, 'PROPIEDAD');

  const openPropiedad = () => {
    navigate(PROPIEDADES_PATH, { state: propiedadDetailState(propiedad.id || propiedad._id) });
  };

  return (
    <Box sx={getPropiedadHubBlockSx({ isLast })}>
      <Box
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          openPropiedad();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPropiedad();
          }
        }}
        sx={propiedadHubHeaderSx}
      >
        <TipoPropiedadIcon tipo={propiedad.tipo} sx={propiedadHubIconSx} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={propiedadHubTitleSx}>
            {getPropiedadLabel(propiedad)}
          </Typography>
          {(propiedad.ciudad || propiedad.direccion) && (
            <Typography noWrap sx={propiedadHubSubtitleSx}>
              {propiedad.ciudad || propiedad.direccion}
            </Typography>
          )}
        </Box>
        <Box component="span" sx={getPropiedadEstadoChipSx(estadoColor)}>
          {getEstadoText(estado, 'PROPIEDAD')}
        </Box>
      </Box>

      {showHabitaciones ? (
        habitaciones.length === 0 ? (
          <Typography sx={propiedadHubEmptySx}>Sin ambientes</Typography>
        ) : (
          <Box sx={propiedadHubCarouselAreaSx}>
            <MonedasCarousel sx={propiedadHubCarouselSx}>
              {habitaciones.map((hab) => (
                <HabitacionTile
                  key={hab.id || hab._id}
                  habitacion={hab}
                  onSelect={() =>
                    navigate(PROPIEDADES_PATH, {
                      state: propiedadDetailState(propiedad.id || propiedad._id, {
                        habitacionId: hab.id || hab._id,
                      }),
                    })
                  }
                />
              ))}
            </MonedasCarousel>
          </Box>
        )
      ) : null}
    </Box>
  );
}
