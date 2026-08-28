import { DEFAULT_HABIT_ITEM_CONFIG } from './habitSectionIds.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import { VALID_TIME_OF_DAY } from '../../utils/timeOfDayUtils.js';

function isTrueDailyTipo(config = {}) {
  return (config?.tipo || 'DIARIO').toUpperCase() === 'DIARIO';
}

function normalizeHorariosList(horarios) {
  if (!Array.isArray(horarios)) return [];
  return horarios
    .map((horario) => String(horario).toUpperCase())
    .filter(Boolean);
}

/**
 * Deriva franjas horarias solo para tipo DIARIO con frecuencia > 1.
 * PERSONALIZADO CADA_DIA usa frecuencia como intervalo en días, no como veces/día.
 */
export function resolveEffectiveDailyHorarios(config = {}) {
  const horarios = normalizeHorariosList(config.horarios);
  if (horarios.length > 0) return horarios;
  if (!isTrueDailyTipo(config)) return [];

  const frecuencia = Number(config.frecuencia || 1);
  if (frecuencia <= 1) return [];

  return VALID_TIME_OF_DAY.slice(0, frecuencia);
}

function withEffectiveHorarios(config = {}) {
  return {
    ...config,
    horarios: resolveEffectiveDailyHorarios(config),
  };
}

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

  const merged = withEffectiveHorarios({
    ...DEFAULT_HABIT_ITEM_CONFIG,
    ...(rutinaCfg || {}),
    ...(hasPref ? prefCfg : {}),
    horarios,
  });

  merged.activo = rutinaCfg?.activo ?? prefCfg?.activo ?? true;

  return merged;
}

/**
 * Config efectiva para la UI de rutinas.
 * Histórico: snapshot del día; si no tiene franjas, usa prefs actuales para visualización.
 * Hoy/futuro: fusiona plantilla del usuario sobre rutina.config.
 */
export function resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences = {}) {
  if (!section || !itemId) return { ...DEFAULT_HABIT_ITEM_CONFIG };

  const rutinaCfg = rutina?.config?.[section]?.[itemId];
  const prefCfg = habitsPreferences?.[section]?.[itemId];

  if (rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical') {
    const snapshot = {
      ...DEFAULT_HABIT_ITEM_CONFIG,
      ...(rutinaCfg || {}),
    };

    const snapshotHorarios = normalizeHorariosList(snapshot.horarios);
    const prefHorarios = normalizeHorariosList(prefCfg?.horarios);

    if (snapshotHorarios.length === 0 && prefHorarios.length > 0) {
      return withEffectiveHorarios({
        ...snapshot,
        frecuencia: Math.max(
          Number(prefCfg?.frecuencia || 1),
          prefHorarios.length,
          Number(snapshot.frecuencia || 1),
        ),
        horarios: prefHorarios,
      });
    }

    return withEffectiveHorarios(snapshot);
  }

  return resolveCarouselItemConfig(section, itemId, rutina, habitsPreferences);
}
