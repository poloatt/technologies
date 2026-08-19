import { alpha } from '@mui/material/styles';
import { HUB_SECTION, hubSectionBg } from '@shared/styles/hubSectionStyles';

/** Bloque de propiedad dentro del cuerpo de sección (sin tarjeta anidada). */
export function getPropiedadHubBlockSx({ isLast = false } = {}) {
  return {
    borderBottom: isLast ? 0 : 1,
    borderColor: 'divider',
    pb: isLast ? 0 : HUB_SECTION.blockGap,
    mb: isLast ? 0 : HUB_SECTION.blockGap,
    overflow: 'hidden',
  };
}

export const propiedadHubHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  cursor: 'pointer',
  py: 0.5,
  px: 0.125,
  borderRadius: 1.5,
  transition: 'background-color 0.15s ease',
  '&:hover': { bgcolor: hubSectionBg },
};

export const propiedadHubIconSx = {
  fontSize: 20,
  color: 'text.secondary',
  flexShrink: 0,
};

export const propiedadHubTitleSx = {
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.45,
  color: 'text.primary',
  display: 'block',
};

export const propiedadHubSubtitleSx = {
  fontSize: '0.75rem',
  lineHeight: 1.35,
  color: 'text.secondary',
  display: 'block',
  mt: 0.25,
};

export function getPropiedadEstadoChipSx(estadoColor) {
  return (theme) => {
    const resolved =
      typeof estadoColor === 'string' && estadoColor.includes('.')
        ? theme.palette[estadoColor.split('.')[0]]?.[estadoColor.split('.')[1]] ||
          theme.palette.text.secondary
        : estadoColor;

    return {
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      px: 1.25,
      py: 0.375,
      borderRadius: '16px',
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.35,
      color: estadoColor,
      bgcolor: alpha(resolved, theme.palette.mode === 'dark' ? 0.16 : 0.1),
      border: 'none',
    };
  };
}

export const propiedadHubCarouselAreaSx = {
  px: 0.125,
  pt: 0.75,
};

export const propiedadHubCarouselSx = {
  py: 0.125,
};

export const propiedadHubEmptySx = {
  display: 'block',
  px: 0.125,
  py: 0.75,
  fontSize: '0.75rem',
  color: 'text.disabled',
};

/**
 * Switch compacto alineado con subsecciones hub (píldora, borde divider, primary al activar).
 */
export const cajaSwitchSx = {
  width: 30,
  height: 16,
  p: 0,
  flexShrink: 0,
  '& .MuiSwitch-switchBase': {
    p: 0,
    top: '50%',
    left: 2,
    transform: 'translateY(-50%)',
    transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&.Mui-checked': {
      transform: 'translate(14px, -50%)',
      '& .MuiSwitch-thumb': {
        borderColor: 'primary.main',
      },
      '& + .MuiSwitch-track': {
        bgcolor: 'primary.main',
        borderColor: 'primary.main',
        opacity: 1,
      },
    },
    '&.Mui-disabled': {
      opacity: 0.5,
      '& + .MuiSwitch-track': { opacity: 0.5 },
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 11,
    height: 11,
    boxShadow: (theme) => theme.shadows[1],
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
  },
  '& .MuiSwitch-track': {
    borderRadius: 8,
    opacity: 1,
    bgcolor: (theme) =>
      alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.06),
    border: '1px solid',
    borderColor: 'divider',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
  },
};
