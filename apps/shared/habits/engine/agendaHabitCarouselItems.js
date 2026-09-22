import {
  groupRutinaHabitsByCadence,
  groupDailyCadenceBucketByFranjaSchedule,
} from '../desktop/rutinaCadenceUtils.js';
import { resolveHabitCadenceBucket } from '../utils/habitCadenceBuckets.js';
import { isScheduledCadenciaDay } from '../utils/cadenciaUtils.js';
import { parseAPIDate } from '../../utils/dateUtils.js';

function buildCarouselEntry(section, itemId, horario = null) {
  return {
    section,
    itemId,
    ...(horario ? { horario } : {}),
  };
}

function isDailyCadenceConfig(config = {}) {
  return resolveHabitCadenceBucket(config) === 'DIARIO';
}

/** Copia local para no acoplar este módulo al engine (evita ciclos de import). */
function isFlexiblePeriodic(itemConfig) {
  const tipo = (itemConfig?.tipo || 'DIARIO').toUpperCase();
  const periodo = (itemConfig?.periodo || 'CADA_DIA').toUpperCase();
  if (tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA')) {
    const diasSemana = Array.isArray(itemConfig.diasSemana) ? itemConfig.diasSemana : [];
    return diasSemana.length === 0;
  }
  if (tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES')) {
    const diasMes = Array.isArray(itemConfig.diasMes) ? itemConfig.diasMes : [];
    return diasMes.length === 0;
  }
  return false;
}

/**
 * ¿El periódico tiene el día de la rutina en su calendario fijo?
 * Flexibles no usan días fijos (van a Ahora solo vía ritmo / showToday).
 */
function isFixedPeriodicScheduledOnRutina(entry, rutina) {
  if (!entry?.config || isFlexiblePeriodic(entry.config)) return true;
  if (isDailyCadenceConfig(entry.config)) return true;
  const fecha = rutina?.fecha ? parseAPIDate(rutina.fecha) : null;
  if (!fecha) return false;
  return isScheduledCadenciaDay(fecha, entry.config);
}

/**
 * Mapea entradas del splitter de cadencia → ítems de carrusel.
 * Fuera del calendario fijo no aparecen en Tareas (sí pueden verse en /rutinas Semanal).
 */
function mapScheduleEntriesToCarouselItems(entries, rutina, sectionIconsMap) {
  const items = [];
  const itemsSet = new Set();
  const iconsMap = sectionIconsMap?.iconsMap || {};

  (entries || []).forEach((entry) => {
    const section = entry?.section;
    const itemId = entry?.itemId;
    if (!section || !itemId) return;
    if (!iconsMap[section]?.[itemId]) return;

    if (!isFixedPeriodicScheduledOnRutina(entry, rutina)) {
      return;
    }

    const horario = entry.franjaKey || null;
    const slotKey = horario ? `${section}.${itemId}.${horario}` : `${section}.${itemId}`;
    if (itemsSet.has(slotKey)) return;
    itemsSet.add(slotKey);
    items.push(buildCarouselEntry(section, itemId, horario));
  });

  return items;
}

/**
 * Carrusel Ahora/Luego alineado con la vista de rutinas (cadence-flat).
 * SSOT: groupRutinaHabitsByCadence → groupDailyCadenceBucketByFranjaSchedule.
 *
 * @param {'ahora'|'luego'} mode
 * @param {object} params
 * @param {string} [params.currentTimeOfDay] override de franja activa (tests / no-hoy)
 */
export function getAgendaHabitCarouselItems(mode, {
  rutinaHoy,
  sectionIconsMap,
  habits,
  currentTimeOfDay,
  habitsPreferences = {},
  habitChains = [],
  customSections = [],
  allRutinas = [],
} = {}) {
  if (!rutinaHoy) return [];

  const buckets = groupRutinaHabitsByCadence({
    rutina: rutinaHoy,
    habits,
    habitsPreferences,
    habitChains,
    customSections,
    iconsMap: sectionIconsMap?.iconsMap || null,
  });

  const diarioBucket = buckets.find((bucket) => bucket.id === 'DIARIO');
  if (!diarioBucket) return [];

  const schedule = groupDailyCadenceBucketByFranjaSchedule(
    diarioBucket,
    rutinaHoy,
    allRutinas,
    currentTimeOfDay ? { activeFranja: currentTimeOfDay } : {},
  );

  const entries = mode === 'luego' ? schedule.luego : schedule.ahora;
  return mapScheduleEntriesToCarouselItems(entries, rutinaHoy, sectionIconsMap);
}

export function getCarouselAhoraItems(params) {
  return getAgendaHabitCarouselItems('ahora', params);
}

export function getCarouselLuegoItems(params) {
  return getAgendaHabitCarouselItems('luego', params);
}

export function getCarouselItemsForMode(mode, params) {
  if (mode === 'luego') return getCarouselLuegoItems(params);
  return getCarouselAhoraItems(params);
}
