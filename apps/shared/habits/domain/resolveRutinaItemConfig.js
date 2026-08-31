import { DEFAULT_HABIT_ITEM_CONFIG } from './habitSectionIds.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import { normalizeTimeOfDay, VALID_TIME_OF_DAY } from '../../utils/timeOfDayUtils.js';

function isTrueDailyTipo(config = {}) {
  return (config?.tipo || 'DIARIO').toUpperCase() === 'DIARIO';
}

function normalizeHorariosList(horarios) {
  return normalizeTimeOfDay(horarios);
}

function hasOwnCadenceField(cfg, key) {
  if (!cfg || typeof cfg !== 'object') return false;
  const value = cfg[key];
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return true;
  return true;
}

/**
 * Snapshot histórico puede venir incompleto: rellena cadencia desde prefs
 * sin pisar campos explícitos del día.
 */
function mergeHistoricalHabitConfig(snapshotCfg = {}, prefCfg = null) {
  const prefs = prefCfg && typeof prefCfg === 'object' ? prefCfg : {};
  const snapshot = snapshotCfg && typeof snapshotCfg === 'object' ? snapshotCfg : {};

  const pick = (key, fallback) => {
    if (hasOwnCadenceField(snapshot, key)) return snapshot[key];
    if (hasOwnCadenceField(prefs, key)) return prefs[key];
    return fallback;
  };

  const merged = {
    ...DEFAULT_HABIT_ITEM_CONFIG,
    ...prefs,
    ...snapshot,
    tipo: pick('tipo', DEFAULT_HABIT_ITEM_CONFIG.tipo),
    periodo: pick('periodo', DEFAULT_HABIT_ITEM_CONFIG.periodo),
    frecuencia: pick('frecuencia', DEFAULT_HABIT_ITEM_CONFIG.frecuencia),
    diasSemana: pick('diasSemana', prefs.diasSemana ?? snapshot.diasSemana),
    diasMes: pick('diasMes', prefs.diasMes ?? snapshot.diasMes),
    activo: snapshot.activo ?? prefs.activo ?? true,
  };

  const snapshotHorarios = normalizeHorariosList(snapshot.horarios);
  const prefHorarios = normalizeHorariosList(prefs.horarios);
  if (snapshotHorarios.length > 0) {
    merged.horarios = snapshotHorarios;
  } else if (prefHorarios.length > 0) {
    merged.horarios = prefHorarios;
    merged.frecuencia = Math.max(
      Number(merged.frecuencia || 1),
      prefHorarios.length,
      Number(prefs.frecuencia || 1),
    );
  } else {
    merged.horarios = [];
  }

  return merged;
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
 * Histórico: snapshot del día; campos de cadencia faltantes se rellenan desde prefs.
 * Hoy/futuro: fusiona plantilla del usuario sobre rutina.config.
 */
export function resolveRutinaItemConfig(section, itemId, rutina, habitsPreferences = {}) {
  if (!section || !itemId) return { ...DEFAULT_HABIT_ITEM_CONFIG };

  const rutinaCfg = rutina?.config?.[section]?.[itemId];
  const prefCfg = habitsPreferences?.[section]?.[itemId];

  if (rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical') {
    return withEffectiveHorarios(mergeHistoricalHabitConfig(rutinaCfg, prefCfg));
  }

  return resolveCarouselItemConfig(section, itemId, rutina, habitsPreferences);
}
