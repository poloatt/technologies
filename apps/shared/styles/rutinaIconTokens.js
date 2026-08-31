/**
 * Tamaños táctiles unificados para iconos de hábitos en rutinas (mobile-first).
 * WCAG recomienda ≥44px; mobile usa 48px para mayor comodidad al tocar.
 */

/** Botón circular de hábito (checklist + carrusel). */
export const RUTINA_HABIT_ICON_SIZE = {
  mobile: 48,
  desktop: 44,
  compact: 36,
  stackCell: 36,
  carouselDense: 36,
  carouselDefault: 40,
};

/** Glifo dentro del botón circular de hábito. */
export const RUTINA_HABIT_ICON_GLYPH = {
  mobile: '1.45rem',
  desktop: '1.35rem',
  compact: '1.2rem',
};

/** Alias canónico (feature Hábitos) — misma escala en lista, stack y carrusel. */
export const HABIT_ICON_SIZE = RUTINA_HABIT_ICON_SIZE;
export const HABIT_ICON_GLYPH = RUTINA_HABIT_ICON_GLYPH;

/**
 * Tokens de botón circular de hábito según contexto.
 * @param {{ mobile?: boolean, compact?: boolean, stackCell?: boolean, dense?: boolean }} opts
 */
export function getHabitIconTokens({
  mobile = false,
  compact = false,
  stackCell = false,
  dense = false,
} = {}) {
  return getRutinaHabitIconTokens({ mobile, compact, stackCell, dense });
}

/** @deprecated Prefer getHabitIconTokens */
export function getRutinaHabitIconTokens({
  mobile = false,
  compact = false,
  stackCell = false,
  dense = false,
} = {}) {
  if (stackCell) {
    return {
      size: RUTINA_HABIT_ICON_SIZE.stackCell,
      glyph: RUTINA_HABIT_ICON_GLYPH.compact,
    };
  }
  if (compact || dense) {
    return {
      size: RUTINA_HABIT_ICON_SIZE.compact,
      glyph: RUTINA_HABIT_ICON_GLYPH.compact,
    };
  }
  if (mobile) {
    return {
      size: RUTINA_HABIT_ICON_SIZE.mobile,
      glyph: RUTINA_HABIT_ICON_GLYPH.mobile,
    };
  }
  return {
    size: RUTINA_HABIT_ICON_SIZE.desktop,
    glyph: RUTINA_HABIT_ICON_GLYPH.desktop,
  };
}

/** Celda del picker de iconos de hábito. */
export const RUTINA_PICKER_ICON_SIZE = {
  mobile: 48,
  desktop: 44,
};

export const RUTINA_PICKER_ICON_GLYPH = {
  mobile: '1.45rem',
  desktop: '1.35rem',
};

/** Botón título del picker (variant title). */
export const RUTINA_PICKER_TITLE_BUTTON_SIZE = {
  mobile: 44,
  desktop: 36,
};

/** Chevron de expandir sección / franja. */
export const RUTINA_CHEVRON = {
  mobile: { button: 28, glyph: '1.25rem' },
  desktop: { button: 20, glyph: '1rem' },
};

/** Handle de drag en filas sortables. */
export const RUTINA_DRAG_HANDLE_GLYPH = {
  mobile: 20,
  desktop: 18,
};

/** Iconos de acción secundaria en filas (unfold, tune, etc.). */
export const RUTINA_ROW_ACTION_GLYPH = {
  mobile: '1.25rem',
  desktop: '1.1rem',
};

export function getRutinaPickerIconTokens(mobile = false) {
  return mobile
    ? { size: RUTINA_PICKER_ICON_SIZE.mobile, glyph: RUTINA_PICKER_ICON_GLYPH.mobile }
    : { size: RUTINA_PICKER_ICON_SIZE.desktop, glyph: RUTINA_PICKER_ICON_GLYPH.desktop };
}

export function getRutinaChevronTokens(mobile = false) {
  return mobile ? RUTINA_CHEVRON.mobile : RUTINA_CHEVRON.desktop;
}

export function getRutinaDragHandleGlyph(mobile = false) {
  return mobile ? RUTINA_DRAG_HANDLE_GLYPH.mobile : RUTINA_DRAG_HANDLE_GLYPH.desktop;
}
