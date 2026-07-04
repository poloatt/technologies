import { computeCarouselToggleValue } from './habitToggleUtils.js';
import { resolveRutinaItemConfig } from './resolveRutinaItemConfig.js';

/**
 * Calcula el nuevo valor de completado para rutinas/carrusel con franja explícita.
 */
export function computeRutinaToggleValue({
  section,
  itemId,
  rutina,
  habitsPreferences = {},
  horario = null,
  currentTimeOfDay = null,
}) {
  const itemConfig = resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences);
  const itemValue = rutina?.[section]?.[itemId];
  const horariosConfig = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];

  let normalizedHorario = horario ? String(horario).toUpperCase() : null;
  if (!normalizedHorario && horariosConfig.length === 1) {
    normalizedHorario = String(horariosConfig[0]).toUpperCase();
  }
  if (!normalizedHorario && horariosConfig.length > 1 && currentTimeOfDay) {
    normalizedHorario = String(currentTimeOfDay).toUpperCase();
  }

  return computeCarouselToggleValue({
    itemValue,
    horariosConfig,
    normalizedHorario,
  });
}
