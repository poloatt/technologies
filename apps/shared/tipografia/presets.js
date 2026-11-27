import { FONT_FAMILY } from './familias';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, LINE_HEIGHT } from './escala';
import { hingeHeadlineSx } from './hinge';

// ===== TEXTO GENERAL =====

/** Título de página (Movimientos, Dólares, Inversiones…): serif estilo Hinge. */
export const pageTitleSx = {
  ...hingeHeadlineSx,
  fontFamily: FONT_FAMILY.serif,
  fontSize: FONT_SIZE['2xl'],
  color: 'text.primary',
};

export const sectionTitleSx = {
  fontSize: FONT_SIZE.lg,
  fontWeight: FONT_WEIGHT.semibold,
  lineHeight: LINE_HEIGHT.snug,
};

export const bodySx = {
  fontSize: FONT_SIZE.md,
  lineHeight: LINE_HEIGHT.normal,
};

export const bodyCompactSx = {
  fontSize: FONT_SIZE.md,
  lineHeight: LINE_HEIGHT.snug,
  letterSpacing: LETTER_SPACING.wide,
};

export const captionSx = {
  fontSize: FONT_SIZE.sm,
  lineHeight: LINE_HEIGHT.snug,
  color: 'text.secondary',
};

// ===== SALDOS EN TARJETAS HUB =====
/**
 * Escala de los resúmenes de saldo en tarjetas hub (todas las apps).
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
export const HUB_EYEBROW_FONT_SIZE = FONT_SIZE.xs;

export const hubEyebrowSx = {
  display: 'block',
  fontSize: HUB_EYEBROW_FONT_SIZE,
  fontWeight: FONT_WEIGHT.medium,
  lineHeight: 1.15,
  letterSpacing: LETTER_SPACING.widest,
  textTransform: 'uppercase',
  color: 'text.secondary',
};

export const HUB_HERO_AMOUNT = {
  denseFontSize: HUB_EYEBROW_FONT_SIZE,
  pageFontSize: FONT_SIZE['4xl'],
  lineHeight: 1.15,
};

export function getHubHeroAmountSx(dense = true) {
  return {
    ...hubNumericSx,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: dense ? HUB_HERO_AMOUNT.denseFontSize : HUB_HERO_AMOUNT.pageFontSize,
    lineHeight: HUB_HERO_AMOUNT.lineHeight,
    letterSpacing: LETTER_SPACING.tighter,
  };
}

export const hubSupportAmountSx = {
  ...hubNumericSx,
  fontWeight: FONT_WEIGHT.semibold,
  fontSize: FONT_SIZE.md,
  lineHeight: LINE_HEIGHT.snug,
  letterSpacing: '-0.005em',
};

// ===== NAVEGACIÓN =====
// Usamos variants de MUI y solo dejamos tamaños puntuales cuando el layout lo exige (ej: bottom nav).
export const NAV_TYPO = {
  // Texto en items de sidebar / navegación principal
  itemVariant: 'body2',
  // Texto pequeño auxiliar (chips, captions)
  captionVariant: 'caption',
  // Título principal en Header (ruta/página)
  headerTitleVariant: 'subtitle2',
  headerTitleSx: { fontWeight: FONT_WEIGHT.semibold, lineHeight: LINE_HEIGHT.snug, letterSpacing: LETTER_SPACING.wide },
  // Labels en Chips dentro de navegación (footer/rutinas)
  chipLabelSx: { typography: 'caption', lineHeight: 1.1, letterSpacing: LETTER_SPACING.wide },
  // Bottom navigation suele necesitar un poco más chico para evitar overflow
  bottomNavLabelSx: { fontSize: FONT_SIZE.sm, lineHeight: 1.1, letterSpacing: LETTER_SPACING.wide },
  // Usado en lugares donde body2 queda grande pero no queremos hardcodes sueltos
  compactBodySx: { fontSize: FONT_SIZE.md, lineHeight: LINE_HEIGHT.snug, letterSpacing: LETTER_SPACING.wide },
};
