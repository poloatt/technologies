import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import { getHabitSectionKeys } from './habitSectionIds.js';
import { resolveRutinaItemConfig } from './resolveRutinaItemConfig.js';
import { ensureHabitCompletionShape, rutinaItemValuesDiffer } from './habitCompletionUtils.js';

/**
 * Arma payload PATCH para rutinas históricas cuyo snapshot no tiene franjas
 * pero la config efectiva (prefs / frecuencia) sí las define.
 */
export function buildHistoricalFranjaMigrationPayload(
  rutina,
  habitsPreferences = {},
  habits = null,
) {
  if (!rutina?._id || !rutina?.fecha || getRutinaDayMode(rutina.fecha) !== 'historical') {
    return null;
  }

  const updatePayload = { _id: rutina._id, config: {} };
  let hasConfigChange = false;
  let hasSectionChange = false;

  getHabitSectionKeys(habits).forEach((section) => {
    const sectionData = rutina[section] || {};
    const itemIds = new Set([
      ...Object.keys(sectionData),
      ...Object.keys(rutina.config?.[section] || {}),
    ]);

    itemIds.forEach((itemId) => {
      const resolvedConfig = resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences);
      const resolvedHorarios = Array.isArray(resolvedConfig.horarios) ? resolvedConfig.horarios : [];
      if (resolvedHorarios.length === 0) return;

      const storedConfig = rutina.config?.[section]?.[itemId] || {};
      const storedHorarios = Array.isArray(storedConfig.horarios) ? storedConfig.horarios : [];

      if (storedHorarios.length === 0) {
        if (!updatePayload.config[section]) updatePayload.config[section] = {};
        updatePayload.config[section][itemId] = {
          ...storedConfig,
          frecuencia: resolvedConfig.frecuencia,
          horarios: resolvedHorarios,
        };
        hasConfigChange = true;
      }

      const currentValue = sectionData[itemId];
      const reshaped = ensureHabitCompletionShape(currentValue, resolvedConfig);
      if (rutinaItemValuesDiffer(currentValue, reshaped)) {
        if (!updatePayload[section]) updatePayload[section] = {};
        updatePayload[section][itemId] = reshaped;
        hasSectionChange = true;
      }
    });
  });

  if (!hasConfigChange && !hasSectionChange) return null;
  if (!hasConfigChange) delete updatePayload.config;
  return updatePayload;
}
