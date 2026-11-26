/**
 * Trazo sutil de la app: el mismo de los divisores (`MuiDivider`).
 * 1px, gris neutro con baja opacidad. Sirve para contornos de selección,
 * bordes de chips y cualquier línea que deba leerse sin pesar.
 */
export const SUBTLE_STROKE_WIDTH = '1px';
export const SUBTLE_STROKE_COLOR = 'rgba(140, 140, 140, 0.15)';

/** `border` completo, listo para usar en `sx`. */
export const subtleStroke = `${SUBTLE_STROKE_WIDTH} solid ${SUBTLE_STROKE_COLOR}`;

/** Contorno de un elemento seleccionado: sin relleno, solo el trazo sutil. */
export const subtleOutlineSx = {
  border: subtleStroke,
  bgcolor: 'transparent',
};
