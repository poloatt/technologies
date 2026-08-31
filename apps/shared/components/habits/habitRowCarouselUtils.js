/**
 * Carrusel horizontal de iconos en filas (Rutinas, checklist multi-franja).
 * Misma UX que Tareas: HabitCarouselScrollTrack + drag scroll + fades laterales.
 */

/** ¿Varios iconos en la misma fila en pantalla reducida? → carrusel horizontal. */
export function shouldUseHabitRowIconCarousel({
  mobile = false,
  itemCount = 0,
  minItems = 2,
} = {}) {
  return Boolean(mobile) && Number(itemCount) >= minItems;
}
