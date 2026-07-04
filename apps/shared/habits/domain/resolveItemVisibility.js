import shouldShowItem from '../utils/shouldShowItem.js';
import { toPlainRutinaSnapshot } from './plainRutinaSnapshot.js';

/**
 * Punto de entrada único para visibilidad de ítems de rutina (cadencia + horario opcional).
 * @param {object} [options] — p.ej. `{ skipHorarioFilter: true }` para panel rutinas / backend.
 */
export function resolveItemVisibility(section, itemId, rutina, options = {}) {
  if (!section || !itemId || !rutina) return false;

  const plain = toPlainRutinaSnapshot(rutina);

  return shouldShowItem(section, itemId, plain, options);
}

/** Visibilidad por cadencia del día, sin filtro de franja horaria. */
export function resolveItemVisibilityByCadence(section, itemId, rutina, additionalData = {}) {
  return resolveItemVisibility(section, itemId, rutina, {
    ...additionalData,
    skipHorarioFilter: true,
  });
}

/** Alias para backend save / completitud (misma cadencia que panel rutinas). */
export function shouldShowRutinaItem(section, itemId, rutina) {
  return resolveItemVisibilityByCadence(section, itemId, rutina);
}
