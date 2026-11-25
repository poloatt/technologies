import { alpha } from '@mui/material/styles';

/**
 * Fondo sólido del tema oscuro (#181818). Sin transparencia: lo de atrás no se ve.
 * EMERGENT_WINDOW_TINT queda en 1 para quien quiera teñir el mismo color.
 */
export const EMERGENT_WINDOW_TINT = 1;

export function emergentWindowSurface(theme) {
  return alpha(theme.palette.background.default, EMERGENT_WINDOW_TINT);
}

export const emergentWindowPaperSx = {
  borderRadius: 0,
  backgroundImage: 'none',
  bgcolor: emergentWindowSurface,
  color: 'text.primary',
  display: 'flex',
  flexDirection: 'column',
  minHeight: { xs: '100%', sm: '64vh' },
  maxHeight: { xs: '100%', sm: '88vh' },
  boxShadow: 'none',
};

/** Misma ventana, pero media pantalla y centrada. Solo desktop; en mobile sigue a pantalla completa. */
export const emergentWindowHalfPaperSx = {
  width: '50vw',
  maxWidth: '50vw',
  height: '50vh',
  minHeight: '50vh',
  maxHeight: '50vh',
  margin: 0,
};

export const emergentWindowHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 1.25,
  py: 0.75,
  borderBottom: 1,
  borderColor: 'divider',
  bgcolor: 'transparent',
  flexShrink: 0,
};

export const emergentWindowBodySx = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  bgcolor: 'transparent',
};

export const emergentWindowIconButtonSx = {
  width: { xs: 32, sm: 26 },
  height: { xs: 32, sm: 26 },
  padding: { xs: 0.25, sm: 0.125 },
  color: 'primary.main',
  '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
  '&:hover': { backgroundColor: 'action.hover' },
};

export const emergentWindowTitleSx = {
  fontWeight: 600,
  lineHeight: 1.2,
};
