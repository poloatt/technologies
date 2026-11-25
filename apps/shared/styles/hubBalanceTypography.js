/**
 * Escala tipográfica de los resúmenes de saldo en tarjetas hub (todas las apps).
 *  1. Hero: el monto principal de la sección (700). En el hub compacto iguala el tamaño
 *     de la etiqueta de cuenta; en página va grande.
 *  2. Soporte: montos del desglose (600), siempre más chicos que el hero.
 *  3. Eyebrow: cuenta, etiquetas y período (500, mayúsculas, aire entre letras).
 * Solo el hero va en negrita plena; el resto cede para que el ojo vaya al saldo.
 */

/** Cifras de ancho fijo para que los montos no "bailen" entre secciones. */
export const hubNumericSx = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
};

/** Tamaño de la etiqueta; el monto del hub compacto lo iguala para que cuenta y saldo lean como una línea. */
export const HUB_EYEBROW_FONT_SIZE = '0.6875rem';

export const hubEyebrowSx = {
  display: 'block',
  fontSize: HUB_EYEBROW_FONT_SIZE,
  fontWeight: 500,
  lineHeight: 1.15,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
};

export const HUB_HERO_AMOUNT = {
  denseFontSize: HUB_EYEBROW_FONT_SIZE,
  pageFontSize: '1.75rem',
  lineHeight: 1.15,
};

export function getHubHeroAmountSx(dense = true) {
  return {
    ...hubNumericSx,
    fontWeight: 700,
    fontSize: dense ? HUB_HERO_AMOUNT.denseFontSize : HUB_HERO_AMOUNT.pageFontSize,
    lineHeight: HUB_HERO_AMOUNT.lineHeight,
    letterSpacing: '-0.015em',
  };
}

export const hubSupportAmountSx = {
  ...hubNumericSx,
  fontWeight: 600,
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  letterSpacing: '-0.005em',
};
