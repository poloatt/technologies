import { alpha } from '@mui/material/styles';
import { HUB_SECTION } from './hubSectionStyles';

/**
 * Filtro por botones: sin radio, sin fondo y sin divisor.
 * El nombre flota debajo del monto. La selección se lee en el brillo de esa etiqueta.
 */
export const filterToggleRowSx = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 1.5,
};

/**
 * En el hub, la fila ocupa el padding inferior de la subsección
 * para que la etiqueta quede sobre el borde de abajo.
 */
export function getFilterToggleHubRowSx() {
  return {
    ...filterToggleRowSx,
    mb: -HUB_SECTION.bodyPy,
  };
}

export function getFilterToggleButtonSx() {
  return {
    appearance: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: '1 1 0',
    minWidth: 0,
    m: 0,
    p: 0,
    border: 0,
    borderRadius: 0,
    bgcolor: 'transparent',
    backgroundImage: 'none',
    boxShadow: 'none',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'center',
  };
}

export const filterToggleAmountSx = {
  m: 0,
  p: 0,
  width: '100%',
  fontWeight: 600,
  fontSize: '0.875rem',
  lineHeight: 1,
  letterSpacing: '-0.005em',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
};

/**
 * Etiqueta chica, pegada al monto. El brillo marca la selección.
 * El mismo aire vale en el hub y en la página.
 */
export function getFilterToggleFloatingLabelSx(selected) {
  return {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    textAlign: 'center',
    m: 0,
    p: 0,
    fontWeight: 500,
    fontSize: '0.6875rem',
    lineHeight: 1,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    userSelect: 'none',
    color: (theme) => alpha(
      theme.palette.text.primary,
      selected
        ? (theme.palette.mode === 'dark' ? 0.92 : 0.78)
        : (theme.palette.mode === 'dark' ? 0.46 : 0.5),
    ),
  };
}
