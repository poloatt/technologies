import { FONT_FAMILY } from './familias';
import { FONT_SIZE, FONT_WEIGHT } from './escala';

/** Bloque `typography` del tema MUI compartido (ThemeContext). */
export const muiTypography = {
  fontFamily: FONT_FAMILY.sans,
  h4: {
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FONT_SIZE['3xl'],
  },
  h6: {
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FONT_SIZE.lg,
  },
  subtitle1: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },
  body1: {
    fontSize: FONT_SIZE.md,
  },
  body2: {
    fontSize: FONT_SIZE.sm,
  },
};
