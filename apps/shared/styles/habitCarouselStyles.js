import { alpha } from '@mui/material/styles';
import { getHabitIconCarouselTokens } from './habitIconStyles';

/** Tokens de superficie del carril (track), no del chrome del icono.
 * El icono usa habitIconStyles / resolveHabitIconPresentation.
 */
export function getHabitCarouselSurface(theme, { dense = false, mobile = false } = {}) {
  const surfaceBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.035)
    : alpha(theme.palette.common.black, 0.03);
  const dividerColor = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.10)
    : alpha(theme.palette.common.black, 0.10);
  const hoverBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.055)
    : alpha(theme.palette.common.black, 0.045);

  const { size, glyph: iconFontSize } = getHabitIconCarouselTokens({ mobile, dense });

  return {
    size,
    iconFontSize,
    bg: surfaceBg,
    hoverBg,
    rail: dividerColor,
    surfaceBg,
    dividerColor,
  };
}

/** Carruseles de rutinas: mismos tamaños que checklist (mobile/desktop, sin dense). */
export function getRutinaHabitCarouselSurface(theme, { mobile = false } = {}) {
  return getHabitCarouselSurface(theme, { mobile, dense: false });
}
