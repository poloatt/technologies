import {
  HABIT_SECTIONS,
  getHabitSectionItemIds,
  findUserHabit,
  getHabitSectionKeys,
} from '../domain/habitSectionIds.js';
import { getHabitDisplayLabel } from '../domain/habitDisplayLabels.js';
import { resolveItemVisibilityByCadence } from '../domain/resolveItemVisibility.js';
import { resolveRutinaItemConfig } from '../domain/resolveRutinaItemConfig.js';
import { isHabitCompletedForHistorial, isHabitFullyCompletedToday, isHabitPartiallyCompletedToday } from '../domain/habitCompletionUtils.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import {
  hasCadenciaDebt,
  isScheduledCadenciaDay,
  obtenerHistorialCompletados,
  contarCompletadosEnPeriodo,
} from '../utils/cadenciaUtils.js';
import { parseAPIDate } from '../../utils/dateUtils.js';
import { RUTINA_DAY_GROUP_COPY } from '../../copy/agendaTerminology.js';
import { getPeriodicCarouselMode } from '../engine/habitVisibilityEngine.js';
import {
  getDailyCarouselAhoraHorarios,
  getDailyCarouselLuegoHorarios,
} from '../utils/habitTimeLogic.js';

/** Orden de franjas en el carrusel de sección (/rutinas). */
export const SECTION_CAROUSEL_SLOTS = ['ahora', 'luego', 'notToday'];

/**
 * Franja visual de un hábito en el carrusel de sección.
 * Solo configuración y día (nunca completado ni deuda) para que el icono no cambie de grupo al marcar.
 */
export function resolveSectionCarouselSlot(entry, { rutina, currentTimeOfDay = 'MAÑANA' } = {}) {
  const { isScheduled, config, section, itemId } = entry;
  if (!isScheduled) return 'notToday';

  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  const pendingValue = false;

  if (isDaily) {
    if (horarios.length === 0) return 'ahora';
    if (getDailyCarouselAhoraHorarios(horarios, currentTimeOfDay, pendingValue).length > 0) {
      return 'ahora';
    }
    if (getDailyCarouselLuegoHorarios(horarios, currentTimeOfDay, pendingValue).length > 0) {
      return 'luego';
    }
    return 'ahora';
  }

  const rutinaPending = rutina
    ? {
      ...rutina,
      [section]: {
        ...(rutina[section] || {}),
        [itemId]: false,
      },
    }
    : rutina;
  const mode = getPeriodicCarouselMode(
    config,
    rutinaPending,
    section,
    itemId,
    currentTimeOfDay,
  );
  if (mode === 'luego') return 'luego';
  return 'ahora';
}

/**
 * Ordena por franja (ahora → luego → no hoy) y dentro de cada una por orden fijo del usuario.
 */
export function sortSectionCarouselBySlot(entries, sortOpts = {}) {
  const buckets = Object.fromEntries(SECTION_CAROUSEL_SLOTS.map((slot) => [slot, []]));
  entries.forEach((entry) => {
    const slot = entry.carouselSlot || 'notToday';
    if (buckets[slot]) buckets[slot].push(entry);
    else buckets.notToday.push(entry);
  });
  return SECTION_CAROUSEL_SLOTS.flatMap((slot) => sortSectionHabitsByFixedOrder(buckets[slot], sortOpts));
}

/**
 * Orden fijo de hábitos en una sección: `orden` del usuario (vía getHabitSectionItemIds),
 * desempate alfabético por label y luego por itemId. No depende del estado completado.
 */
export function sortSectionHabitsByFixedOrder(entries, { section, habits = null } = {}) {
  const orderIndex = new Map(
    getHabitSectionItemIds(section, habits).map((id, index) => [id, index]),
  );

  return [...entries].sort((a, b) => {
    const indexA = orderIndex.get(a.itemId) ?? Number.MAX_SAFE_INTEGER;
    const indexB = orderIndex.get(b.itemId) ?? Number.MAX_SAFE_INTEGER;
    if (indexA !== indexB) return indexA - indexB;
    const labelCmp = (a.label || '').localeCompare(b.label || '', 'es');
    if (labelCmp !== 0) return labelCmp;
    return String(a.itemId || '').localeCompare(String(b.itemId || ''));
  });
}

/** Títulos legibles por sección de rutina. */
export const RUTINA_SECTION_LABELS = {
  bodyCare: 'Cuidado Personal',
  nutricion: 'Nutrición',
  ejercicio: 'Ejercicio',
  cleaning: 'Limpieza',
};

export { HABIT_SECTIONS };

function resolveSectionItemIds(section, habits, iconsMap) {
  const rawIds = getHabitSectionItemIds(section, habits);
  if (!iconsMap) return rawIds;
  const sectionIcons = iconsMap[section] || {};
  return rawIds.filter((id) => sectionIcons[id]);
}

/**
 * Categoriza hábitos de una sección para el panel desktop.
 * @param {object} [params.iconsMap] — mapa MUI opcional; si se omite, incluye todos los IDs (Node/tests).
 * @returns {{ completed, incomplete, notScheduled }}
 */
export function categorizeSectionHabits({
  section,
  rutina,
  habits = null,
  habitsPreferences = null,
  localData = {},
  iconsMap = null,
}) {
  const empty = { completed: [], incomplete: [], notScheduled: [] };
  if (!section || !rutina) return empty;

  const prefs = habitsPreferences ?? {};
  const isHistorical = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';
  const sectionIcons = iconsMap?.[section] || {};
  const itemIds = resolveSectionItemIds(section, habits, iconsMap);

  const rutinaForVisibility = isHistorical
    ? rutina
    : {
      ...rutina,
      config: {
        ...(rutina.config || {}),
        [section]: Object.fromEntries(
          itemIds.map((itemId) => [
            itemId,
            resolveRutinaItemConfig(section, itemId, rutina, prefs),
          ]),
        ),
      },
    };

  const completed = [];
  const incomplete = [];
  const notScheduled = [];

  itemIds.forEach((itemId) => {
    const config = resolveRutinaItemConfig(section, itemId, rutina, prefs);
    if (config.activo === false) return;

    const fromLocal = localData?.[itemId];
    const fromRutina = rutina?.[section]?.[itemId];
    const itemValue = fromLocal !== undefined ? fromLocal : fromRutina;
    const isCompleted = isHabitCompletedForHistorial(itemValue);
    const isScheduled = resolveItemVisibilityByCadence(section, itemId, rutinaForVisibility);

    const fechaRutina = parseAPIDate(rutina.fecha) || new Date();
    const historialDates = [...obtenerHistorialCompletados(itemId, section, rutinaForVisibility)];
    if (isCompleted) {
      historialDates.push(fechaRutina);
    }
    const isCadenciaDebt = !isCompleted
      && hasCadenciaDebt(fechaRutina, config, historialDates)
      && !isScheduledCadenciaDay(fechaRutina, config);

    const entry = {
      section,
      itemId,
      label: getHabitDisplayLabel(section, itemId, habits),
      Icon: sectionIcons[itemId] || null,
      config,
      itemValue,
      isCompleted,
      isScheduled,
      isCadenciaDebt,
      userHabit: findUserHabit(section, itemId, habits),
    };

    if (isCompleted) {
      completed.push(entry);
    } else if (isScheduled) {
      incomplete.push(entry);
    } else {
      notScheduled.push(entry);
    }
  });

  return { completed, incomplete, notScheduled };
}

/** Etiquetas de agrupación del tracker diario (registro del día). */
export const RUTINA_DAY_GROUP_LABELS = RUTINA_DAY_GROUP_COPY;

function isDailyCadenceConfig(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

/**
 * ¿Cuota del período satisfecha o hábito totalmente completado hoy?
 * Usado para mover ítems a "Hecho" en lugar de "No toca hoy".
 */
export function isHabitQuotaOrDayDone({
  config,
  itemValue,
  itemId,
  section,
  rutina,
  rutinaForVisibility = rutina,
}) {
  if (!config || config.activo === false) return false;

  const horarios = Array.isArray(config.horarios) ? config.horarios : [];
  if (isDailyCadenceConfig(config) && horarios.length > 1) {
    return isHabitFullyCompletedToday(itemValue, horarios);
  }

  if (isHabitCompletedForHistorial(itemValue)) {
    return true;
  }

  const fechaRutina = parseAPIDate(rutina?.fecha) || new Date();
  const historialDates = [...obtenerHistorialCompletados(itemId, section, rutinaForVisibility)];
  const frecuencia = Number(config.frecuencia || 1);
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = config.periodo || 'CADA_DIA';
  const completadosEnPeriodo = contarCompletadosEnPeriodo(
    fechaRutina,
    tipo,
    periodo,
    historialDates,
  );

  return completadosEnPeriodo >= frecuencia;
}

/** Clasifica un ítem del tracker: today (pendiente), done (hecho), notToday. */
export function resolveRutinaScheduleBucket(entry, { rutina, rutinaForVisibility = rutina } = {}) {
  const { config, itemValue, isScheduled, itemId, section } = entry;
  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];

  if (isDailyCadenceConfig(config) && horarios.length > 1) {
    if (isHabitFullyCompletedToday(itemValue, horarios)) {
      return 'done';
    }
    if (isHabitPartiallyCompletedToday(itemValue, horarios) || isScheduled) {
      return 'today';
    }
    if (isHabitQuotaOrDayDone({ config, itemValue, itemId, section, rutina, rutinaForVisibility })) {
      return 'done';
    }
    return 'notToday';
  }

  if (isHabitQuotaOrDayDone({ config, itemValue, itemId, section, rutina, rutinaForVisibility })) {
    return 'done';
  }

  if (isScheduled) {
    return 'today';
  }

  return 'notToday';
}

/**
 * Agrupa hábitos de una sección: Hoy (pendientes), Hecho (completos/cuota), No toca hoy.
 */
export function groupSectionHabitsByDaySchedule(params) {
  const { section, habits = null, rutina } = params;
  const { completed, incomplete, notScheduled } = categorizeSectionHabits(params);
  const sortOpts = { section, habits };

  const prefs = params.habitsPreferences ?? {};
  const isHistorical = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';
  const itemIds = [...new Set([
    ...incomplete.map((e) => e.itemId),
    ...completed.map((e) => e.itemId),
    ...notScheduled.map((e) => e.itemId),
  ])];

  const rutinaForVisibility = isHistorical
    ? rutina
    : {
      ...rutina,
      config: {
        ...(rutina.config || {}),
        [section]: Object.fromEntries(
          itemIds.map((itemId) => [
            itemId,
            resolveRutinaItemConfig(section, itemId, rutina, prefs),
          ]),
        ),
      },
    };

  const today = [];
  const done = [];
  const notToday = [];

  [...incomplete, ...completed, ...notScheduled].forEach((entry) => {
    const bucket = resolveRutinaScheduleBucket(entry, { rutina, rutinaForVisibility });
    if (bucket === 'done') done.push(entry);
    else if (bucket === 'today') today.push(entry);
    else notToday.push(entry);
  });

  const sortEntries = (entries) => sortSectionHabitsByFixedOrder(entries, sortOpts);

  return {
    today: sortEntries(today),
    todayPending: today,
    todayCompleted: done,
    done: sortEntries(done),
    notToday: sortEntries(notToday),
  };
}

function resolveItemCarouselDaySchedule(config, fechaRutina) {
  if (!config || config.activo === false) return false;
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  if (isDaily) return true;
  return isScheduledCadenciaDay(fechaRutina, config);
}

/** Todos los hábitos activos de una sección para el carrusel (ahora → luego → no hoy; orden fijo). */
export function getSectionCarouselItems({
  section,
  rutina,
  habits = null,
  habitsPreferences = null,
  iconsMap = null,
  currentTimeOfDay = 'MAÑANA',
}) {
  if (!section || !rutina) return [];

  const prefs = habitsPreferences ?? {};
  const sectionIcons = iconsMap?.[section] || {};
  const itemIds = resolveSectionItemIds(section, habits, iconsMap);
  const sortOpts = { section, habits };
  const fechaRutina = parseAPIDate(rutina.fecha) || new Date();

  const entriesWithSlot = itemIds.reduce((acc, itemId) => {
    if (iconsMap && !sectionIcons[itemId]) return acc;

    const config = resolveRutinaItemConfig(section, itemId, rutina, prefs);
    if (config.activo === false) return acc;

    const itemValue = rutina?.[section]?.[itemId];
    const isCompleted = isHabitCompletedForHistorial(itemValue);
    const isScheduled = resolveItemCarouselDaySchedule(config, fechaRutina);
    const historialDates = [...obtenerHistorialCompletados(itemId, section, rutina)];
    const isCadenciaDebt = !isCompleted
      && hasCadenciaDebt(fechaRutina, config, historialDates)
      && !isScheduledCadenciaDay(fechaRutina, config);

    const entry = {
      section,
      itemId,
      label: getHabitDisplayLabel(section, itemId, habits),
      Icon: sectionIcons[itemId] || null,
      config,
      itemValue,
      isCompleted,
      isScheduled,
      isCadenciaDebt,
      userHabit: findUserHabit(section, itemId, habits),
    };

    acc.push({
      ...entry,
      carouselSlot: resolveSectionCarouselSlot(entry, { rutina, currentTimeOfDay }),
    });
    return acc;
  }, []);

  return sortSectionCarouselBySlot(entriesWithSlot, sortOpts);
}

/**
 * Primera sección con hábitos incompletos programados, o bodyCare por defecto.
 */
export function getDefaultSelectedSection(rutina, habits = null, habitsPreferences = null, iconsMap = null) {
  for (const section of getHabitSectionKeys(habits)) {
    const { incomplete } = categorizeSectionHabits({ section, rutina, habits, habitsPreferences, iconsMap });
    if (incomplete.length > 0) return section;
  }
  return HABIT_SECTIONS[0];
}
