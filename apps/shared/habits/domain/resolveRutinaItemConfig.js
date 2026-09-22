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
 * Snapshot histórico puede venir incompleto: rellena tipo/periodo/días desde prefs
 * sin importar franjas ni subir frecuencia (evita reabrir días cerrados).
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
    // Diario histórico sin horarios en snapshot: usar prefs para expandir
    // Sin marcar (1 hábito → N filas con insignia de franja).
    merged.horarios = prefHorarios;
  } else {
    merged.horarios = [];
  }

  // Conservar frecuencia del snapshot si existe; no subirla con prefs solo para expandir slots.
  if (hasOwnCadenceField(snapshot, 'frecuencia')) {
    merged.frecuencia = snapshot.frecuencia;
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
