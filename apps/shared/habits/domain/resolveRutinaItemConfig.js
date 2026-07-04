import { DEFAULT_HABIT_ITEM_CONFIG } from './habitSectionIds.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';

/**
 * Config efectiva para carrusel: fusiona rutina.config con plantilla del usuario.
 */
export function resolveCarouselItemConfig(section, itemId, rutinaHoy, habitsPreferences = {}) {
  const rutinaCfg = rutinaHoy?.config?.[section]?.[itemId];
  const prefCfg = habitsPreferences?.[section]?.[itemId];
  const hasPref = prefCfg != null;

  const horarios = hasPref
    ? (Array.isArray(prefCfg.horarios) ? prefCfg.horarios : [])
    : (Array.isArray(rutinaCfg?.horarios) ? rutinaCfg.horarios : []);

  const merged = {
    ...DEFAULT_HABIT_ITEM_CONFIG,
    ...(rutinaCfg || {}),
    ...(hasPref ? prefCfg : {}),
    horarios,
  };

  merged.activo = rutinaCfg?.activo ?? prefCfg?.activo ?? true;

  return merged;
}

/**
 * Config efectiva para la UI de rutinas: en días históricos usa snapshot del día;
 * en hoy/futuro fusiona plantilla del usuario sobre rutina.config.
 */
export function resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences = {}) {
  if (!section || !itemId) return { ...DEFAULT_HABIT_ITEM_CONFIG };
  if (rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical') {
    return {
      ...DEFAULT_HABIT_ITEM_CONFIG,
      ...(rutina?.config?.[section]?.[itemId] || {}),
    };
  }
  return resolveCarouselItemConfig(section, itemId, rutina, habitsPreferences);
}
