/**
 * Tipografía "Hinge" (look-alike).
 *
 * Hinge usa Tiempos Headline para titulares (serif editorial, Klim Type) y
 * Modern Era para texto, etiquetas y botones (sans amigable, Family Type).
 * Ambas son comerciales, así que acá usamos alternativas libres con rasgos parecidos:
 *  - Titulares: Newsreader (serif editorial, OFL)  ~ Tiempos Headline
 *  - Cuerpo:    Figtree (sans amigable, OFL)        ~ Modern Era
 *
 * Escala, pesos y tracking siguen la guía de marca de Hinge (hinge.co/brand-resources).
 * Solo Newsreader se carga (ver index.css); Figtree cae al stack de respaldo.
 */

export const HINGE_FONT_FAMILY = {
  headline:
    "'Newsreader Variable', 'Newsreader', 'Tiempos Headline', Georgia, 'Times New Roman', serif",
  body:
    "'Figtree', 'Modern Era', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export const HINGE_FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/** Tracking en em. La guía usa unidades de "Metrics": 10 = 0.01em, 100 = 0.1em, 150 = 0.15em. */
export const HINGE_TRACKING = {
  headline: '0',
  body: '0.01em',
  label: '0.1em',
  labelWide: '0.15em',
};

/** Interlineado. Titulares 110% (desde 30pt), texto 140%. */
export const HINGE_LEADING = {
  headline: 1.1,
  body: 1.4,
  label: 1.2,
};

/** Titulares funcionales: serif semibold. */
export const hingeHeadlineSx = {
  fontFamily: HINGE_FONT_FAMILY.headline,
  fontWeight: HINGE_FONT_WEIGHT.semibold,
  letterSpacing: HINGE_TRACKING.headline,
  lineHeight: HINGE_LEADING.headline,
};

/** Texto de cuerpo: sans regular, tracking leve, interlineado amplio. */
export const hingeBodySx = {
  fontFamily: HINGE_FONT_FAMILY.body,
  fontWeight: HINGE_FONT_WEIGHT.regular,
  letterSpacing: HINGE_TRACKING.body,
  lineHeight: HINGE_LEADING.body,
};

/** Etiquetas, tablas y acentos: sans bold en mayúsculas con tracking amplio. */
export const hingeLabelSx = {
  fontFamily: HINGE_FONT_FAMILY.body,
  fontWeight: HINGE_FONT_WEIGHT.bold,
  letterSpacing: HINGE_TRACKING.label,
  lineHeight: HINGE_LEADING.label,
  textTransform: 'uppercase',
};

/** Igual que hingeLabelSx pero con el tracking más abierto de la guía. */
export const hingeLabelWideSx = {
  ...hingeLabelSx,
  letterSpacing: HINGE_TRACKING.labelWide,
};

export const HINGE = {
  fontFamily: HINGE_FONT_FAMILY,
  fontWeight: HINGE_FONT_WEIGHT,
  tracking: HINGE_TRACKING,
  leading: HINGE_LEADING,
  headline: hingeHeadlineSx,
  body: hingeBodySx,
  label: hingeLabelSx,
  labelWide: hingeLabelWideSx,
};
