import {
  HABIT_SECTIONS,
  getCarouselSectionItemIds,
} from '../domain/habitSectionIds.js';
import {
  endOfMonth,
  endOfWeek,
  startOfWeek,
  startOfDay,
  differenceInDays,
  getDay,
  getDate,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns';
import {
  contarCompletadosEnPeriodo,
  obtenerHistorialCompletados,
  CADENCIA_WEEK_STARTS_ON,
} from '../utils/cadenciaUtils.js';
import { isHabitCompletedForHistorial, isHabitFullyCompletedToday, isHabitHorarioCompleted } from '../domain/habitCompletionUtils.js';
import { getNormalizedToday, toISODateString, parseAPIDate } from '../../utils/dateUtils.js';
import { shouldShowItemSync } from '../utils/visibilityUtils.js';
import {
  getDailyCarouselAhoraHorarios,
  getDailyCarouselLuegoHorarios,
  hasConfiguredHorarioPassed,
  shouldShowHabitForCurrentTime,
} from '../utils/habitTimeLogic.js';
import {
  resolveCarouselItemConfig,
} from '../domain/resolveRutinaItemConfig.js';

export {
  resolveCarouselItemConfig,
  resolveRutinaItemConfig,
} from '../domain/resolveRutinaItemConfig.js';

/**
 * Motor de visibilidad de hábitos en carrusel y tracker.
 * Glosario: @see agendaTerminology — habitSlot.* (diarios), habitPeriodic.flexible (Fase 5)
 */

const WEEK_OPTS = { weekStartsOn: CADENCIA_WEEK_STARTS_ON };

function normalizeTipoPeriodo(itemConfig) {
  const tipo = (itemConfig.tipo || 'DIARIO').toUpperCase();
  const periodo = (itemConfig.periodo || 'CADA_DIA').toUpperCase();
  return { tipo, periodo };
}

function isDailyTipo(tipo, periodo) {
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function isPeriodicTipo(tipo, periodo) {
  if (isDailyTipo(tipo, periodo)) return false;
  return (
    tipo === 'SEMANAL'
    || tipo === 'MENSUAL'
    || (tipo === 'PERSONALIZADO' && (periodo === 'CADA_SEMANA' || periodo === 'CADA_MES'))
  );
}

function getRutinaReferenceDate(rutinaHoy) {
  if (rutinaHoy?.fecha) {
    const parsed = parseAPIDate(rutinaHoy.fecha);
    if (parsed) return parsed;
  }
  return getNormalizedToday();
}

function countCompletionsInPeriod(itemId, section, rutinaHoy, itemConfig) {
  if (!rutinaHoy) return { completadosEnPeriodo: 0, diasRestantes: 0, hoyEsValido: true };

  const { tipo, periodo } = normalizeTipoPeriodo(itemConfig);
  const frecuencia = Number(itemConfig.frecuencia || 1);
  const completadoHoy = isHabitCompletedForHistorial(rutinaHoy?.[section]?.[itemId]);
  const historial = obtenerHistorialCompletados(itemId, section, rutinaHoy);
  const hoy = getRutinaReferenceDate(rutinaHoy);
  const hoyStr = toISODateString(hoy);

  let historialParaContar = historial;
  let diasRestantes = 0;
  let hoyEsValido = true;

  if (tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA')) {
    const diasSemana = Array.isArray(itemConfig.diasSemana) ? itemConfig.diasSemana : [];
    if (diasSemana.length > 0) {
      historialParaContar = historial.filter((fecha) => diasSemana.includes(getDay(fecha)));
      const diaHoy = getDay(hoy);
      hoyEsValido = diasSemana.includes(diaHoy);
      diasRestantes = diasSemana.filter((dia) => dia >= diaHoy).length;
    } else {
      const finSemana = endOfWeek(hoy, WEEK_OPTS);
      diasRestantes = Math.max(0, differenceInDays(finSemana, hoy) + 1);
    }
  } else if (tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES')) {
    const diasMes = Array.isArray(itemConfig.diasMes) ? itemConfig.diasMes : [];
    if (diasMes.length > 0) {
      historialParaContar = historial.filter((fecha) => diasMes.includes(getDate(fecha)));
      const diaHoy = getDate(hoy);
      hoyEsValido = diasMes.includes(diaHoy);
      diasRestantes = diasMes.filter((dia) => dia >= diaHoy).length;
    } else {
      const finMes = endOfMonth(hoy);
      diasRestantes = Math.max(0, differenceInDays(finMes, hoy) + 1);
    }
  }

  let completadosEnPeriodo = contarCompletadosEnPeriodo(hoy, tipo, periodo, historialParaContar);

  if (completadoHoy && hoyEsValido) {
    const yaEstaEnHistorial = historialParaContar.some(
      (fecha) => toISODateString(fecha) === hoyStr,
    );
    if (!yaEstaEnHistorial) {
      completadosEnPeriodo += 1;
    }
  }

  return {
    completadosEnPeriodo,
    diasRestantes,
    hoyEsValido,
    frecuencia,
  };
}

/**
 * SEMANAL/MENSUAL sin diasSemana/diasMes: el usuario elige los días del período.
 * @see agendaTerminology — habitPeriodic.flexible
 */
export function isFlexiblePeriodic(itemConfig) {
  const { tipo, periodo } = normalizeTipoPeriodo(itemConfig);
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

/** Elige `count` fechas repartidas de forma uniforme (incluye extremos). */
function pickEvenlySpacedDates(days, count) {
  if (count <= 0 || !Array.isArray(days) || days.length === 0) return [];
  if (count >= days.length) return [...days];
  if (count === 1) return [days[0]];

  const picked = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * (days.length - 1)) / (count - 1));
    if (!used.has(idx)) {
      used.add(idx);
      picked.push(days[idx]);
    }
  }
  for (let i = 0; i < days.length && picked.length < count; i += 1) {
    if (!used.has(i)) {
      used.add(i);
      picked.push(days[i]);
    }
  }
  return picked.sort((a, b) => a.getTime() - b.getTime());
}

function resolveFlexiblePeriodRemainingDays(hoy, itemConfig) {
  const { tipo, periodo } = normalizeTipoPeriodo(itemConfig);
  const start = startOfDay(hoy);
  let end;
  if (tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES')) {
    end = startOfDay(endOfMonth(hoy));
  } else {
    end = startOfDay(endOfWeek(hoy, WEEK_OPTS));
  }
  if (end < start) return [];
  return eachDayOfInterval({ start, end });
}

/**
 * Plantilla de ritmo para periódicos flexibles (sin días fijos).
 * No aplica a diarios. Si se salta hoy, al recalcular solo quedan días futuros.
 *
 * @returns {null|{
 *   remainingQuota: number,
 *   showToday: boolean,
 *   suggestedWeekdayKeys: number[],
 *   futureWeekdayKeys: number[],
 *   behindPace: boolean,
 *   urgent: boolean,
 * }}
 */
export function resolveFlexiblePeriodicPlan(itemConfig, rutinaHoy, section, itemId) {
  if (!isFlexiblePeriodic(itemConfig) || !rutinaHoy) return null;

  const { completadosEnPeriodo, frecuencia } = countCompletionsInPeriod(
    itemId,
    section,
    rutinaHoy,
    itemConfig,
  );
  const remainingQuota = Math.max(0, frecuencia - completadosEnPeriodo);
  const itemValue = rutinaHoy?.[section]?.[itemId];
  const doneToday = isHabitCompletedForHistorial(itemValue);

  if (remainingQuota <= 0) {
    return {
      remainingQuota: 0,
      showToday: false,
      suggestedWeekdayKeys: [],
      futureWeekdayKeys: [],
      futureSlots: [],
      todayQuotaSlot: doneToday ? completadosEnPeriodo : null,
      behindPace: false,
      urgent: false,
    };
  }

  const hoy = getRutinaReferenceDate(rutinaHoy);
  const periodDays = resolveFlexiblePeriodRemainingDays(hoy, itemConfig);
  const { tipo, periodo } = normalizeTipoPeriodo(itemConfig);
  const isWeekly = tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA');
  const periodLength = isWeekly
    ? 7
    : Math.max(1, differenceInDays(endOfMonth(hoy), new Date(hoy.getFullYear(), hoy.getMonth(), 1)) + 1);
  const weekOrMonthStart = isWeekly
    ? startOfWeek(hoy, WEEK_OPTS)
    : startOfDay(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const dayIndex = Math.max(0, differenceInDays(startOfDay(hoy), startOfDay(weekOrMonthStart)));
  const expectedBeforeToday = Math.floor((frecuencia * dayIndex) / Math.max(periodLength, 1));
  const behindPace = completadosEnPeriodo < expectedBeforeToday;
  const aheadPace = completadosEnPeriodo > expectedBeforeToday;
  const urgent = !doneToday && remainingQuota >= periodDays.length;
  const nextSlotBase = completadosEnPeriodo + 1;

  const assignSlots = (days) => {
    let slot = nextSlotBase;
    let todayQuotaSlot = null;
    const futureSlots = [];
    const suggestedWeekdayKeys = [];
    days.forEach((day) => {
      const quotaSlot = slot;
      slot += 1;
      suggestedWeekdayKeys.push(getDay(day));
      if (isSameDay(day, hoy)) {
        todayQuotaSlot = quotaSlot;
      } else {
        futureSlots.push({ weekdayKey: getDay(day), quotaSlot });
      }
    });
    return {
      todayQuotaSlot,
      futureSlots,
      suggestedWeekdayKeys: [...new Set(suggestedWeekdayKeys)],
      futureWeekdayKeys: [...new Set(futureSlots.map((s) => s.weekdayKey))],
    };
  };

  // 1× por período: suave hasta urgencia/atraso (última ventana); N× reparte plantilla.
  if (frecuencia === 1 && !urgent && !behindPace) {
    const softDays = doneToday
      ? []
      : periodDays.filter((day) => !isSameDay(day, hoy));
    const target = softDays.length > 0 ? softDays[softDays.length - 1] : null;
    const slots = assignSlots(target ? [target] : []);
    return {
      remainingQuota,
      showToday: false,
      todayQuotaSlot: doneToday ? completadosEnPeriodo : null,
      behindPace,
      urgent,
      ...slots,
    };
  }

  const candidates = doneToday
    ? periodDays.filter((day) => !isSameDay(day, hoy))
    : (aheadPace && !behindPace
      ? periodDays.filter((day) => !isSameDay(day, hoy))
      : periodDays);

  const pickPool = (urgent || behindPace) && !doneToday ? periodDays : candidates;
  const picked = pickEvenlySpacedDates(pickPool, Math.min(remainingQuota, pickPool.length));

  const showToday = !doneToday && remainingQuota > 0 && (
    urgent
    || behindPace
    || picked.some((day) => isSameDay(day, hoy))
  );

  const effectiveDays = showToday && !picked.some((day) => isSameDay(day, hoy))
    ? [startOfDay(hoy), ...picked].slice(0, remainingQuota)
    : picked;

  const slots = assignSlots(effectiveDays);

  return {
    remainingQuota,
    showToday,
    todayQuotaSlot: showToday
      ? (slots.todayQuotaSlot ?? nextSlotBase)
      : (doneToday ? completadosEnPeriodo : null),
    behindPace,
    urgent,
    ...slots,
  };
}

/**
 * Colocación en carrusel para hábitos periódicos: 'ahora' | 'luego' | null.
 * - Flexibles (sin días fijos): Ahora si el ritmo propone hoy; franja no destierra a Luego.
 *   Futuros van a plantilla por día (UI), no al cajón Luego genérico.
 * - frecuencia === 1 fijo/urgente: Luego salvo urgencia → Ahora en ventana.
 * - frecuencia > 1 con días fijos: Ahora en ventana; Luego si pasó la ventana.
 */
export function getPeriodicCarouselMode(
  itemConfig,
  rutinaHoy,
  section,
  itemId,
  currentTimeOfDay,
) {
  const { completadosEnPeriodo, frecuencia, hoyEsValido } = countCompletionsInPeriod(
    itemId,
    section,
    rutinaHoy,
    itemConfig,
  );
  if (completadosEnPeriodo >= frecuencia) return null;

  const itemValue = rutinaHoy?.[section]?.[itemId];
  if (isHabitCompletedForHistorial(itemValue)) return null;

  if (isFlexiblePeriodic(itemConfig)) {
    const plan = resolveFlexiblePeriodicPlan(itemConfig, rutinaHoy, section, itemId);
    if (!plan || plan.remainingQuota <= 0) return null;
    return plan.showToday ? 'ahora' : null;
  }

  const horarios = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];
  const inWindow = horarios.length === 0
    || shouldShowHabitForCurrentTime(horarios, currentTimeOfDay, itemValue);
  const passedWindow = horarios.length > 0
    && hasConfiguredHorarioPassed(horarios, currentTimeOfDay);

  if (frecuencia === 1) {
    if (!isUrgentToday(itemId, section, rutinaHoy, itemConfig)) {
      return 'luego';
    }
    if (inWindow) return 'ahora';
    return 'luego';
  }

  if (!hoyEsValido) return 'luego';

  if (inWindow) return 'ahora';
  if (passedWindow) return 'luego';

  if (horarios.length === 0) return 'ahora';

  const futureSlots = getDailyCarouselLuegoHorarios(horarios, currentTimeOfDay, itemValue);
  if (futureSlots.length > 0) return 'luego';

  return null;
}

function isUrgentToday(itemId, section, rutinaHoy, itemConfig) {
  const { completadosEnPeriodo, diasRestantes, frecuencia } = countCompletionsInPeriod(
    itemId,
    section,
    rutinaHoy,
    itemConfig,
  );
  const completadosFaltantes = frecuencia - completadosEnPeriodo;
  if (completadosFaltantes <= 0 || diasRestantes <= 0) return false;
  return completadosFaltantes / diasRestantes >= 1;
}

function shouldShowInCarouselBase(section, itemId, rutinaHoy, itemConfig, currentTimeOfDay) {
  if (!rutinaHoy) return true;
  return shouldShowItemSync(
    section,
    itemId,
    rutinaHoy,
    itemConfig,
    {},
    currentTimeOfDay,
  );
}

function buildCarouselEntry(section, itemId, horario = null) {
  return {
    section,
    itemId,
    ...(horario ? { horario } : {}),
  };
}

function appendDailyCarouselItems({
  mode,
  section,
  itemId,
  itemKey,
  horarios,
  itemValue,
  currentTimeOfDay,
  items,
  itemsSet,
}) {
  if (isHabitFullyCompletedToday(itemValue, horarios)) return;

  if (mode === 'ahora') {
    getDailyCarouselAhoraHorarios(horarios, currentTimeOfDay, itemValue).forEach((horario) => {
      const slotKey = horario ? `${itemKey}.${horario}` : itemKey;
      if (itemsSet.has(slotKey)) return;
      items.push(buildCarouselEntry(section, itemId, horario));
      itemsSet.add(slotKey);
    });
    return;
  }

  const luegoHorarios = getDailyCarouselLuegoHorarios(horarios, currentTimeOfDay, itemValue);
  if (luegoHorarios.length === 0) return;

  const horario = luegoHorarios[0];
  const slotKey = `${itemKey}.${horario}`;
  if (itemsSet.has(slotKey)) return;
  items.push(buildCarouselEntry(section, itemId, horario));
  itemsSet.add(slotKey);
}

function appendPeriodicCarouselItem({
  mode,
  section,
  itemId,
  itemKey,
  itemConfig,
  rutinaHoy,
  currentTimeOfDay,
  items,
  itemsSet,
}) {
  if (!rutinaHoy) return;
  // Flexibles: la franja es preferencia; no ocultar de Ahora si el ritmo propone hoy.
  if (
    mode === 'ahora'
    && !isFlexiblePeriodic(itemConfig)
    && !shouldShowInCarouselBase(section, itemId, rutinaHoy, itemConfig, currentTimeOfDay)
  ) {
    return;
  }

  const placement = getPeriodicCarouselMode(
    itemConfig,
    rutinaHoy,
    section,
    itemId,
    currentTimeOfDay,
  );
  if (placement !== mode) return;
  if (itemsSet.has(itemKey)) return;

  items.push(buildCarouselEntry(section, itemId));
  itemsSet.add(itemKey);
}

function collectCarouselItems(mode, {
  rutinaHoy,
  sectionIconsMap,
  habits,
  currentTimeOfDay,
  habitsPreferences = {},
}) {
  const items = [];
  const itemsSet = new Set();

  HABIT_SECTIONS.forEach((section) => {
    const sectionIcons = sectionIconsMap.iconsMap[section] || {};
    const itemIds = getCarouselSectionItemIds(section, sectionIconsMap.iconsMap, habits);

    itemIds.forEach((itemId) => {
      if (!sectionIcons[itemId]) return;

      const itemConfig = resolveCarouselItemConfig(section, itemId, rutinaHoy, habitsPreferences);
      if (itemConfig.activo === false) return;

      const itemKey = `${section}.${itemId}`;
      const { tipo, periodo } = normalizeTipoPeriodo(itemConfig);
      const itemValue = rutinaHoy?.[section]?.[itemId];
      const horarios = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];

      if (isDailyTipo(tipo, periodo)) {
        appendDailyCarouselItems({
          mode,
          section,
          itemId,
          itemKey,
          horarios,
          itemValue,
          currentTimeOfDay,
          items,
          itemsSet,
        });
        return;
      }

      if (!isPeriodicTipo(tipo, periodo)) return;

      appendPeriodicCarouselItem({
        mode,
        section,
        itemId,
        itemKey,
        itemConfig,
        rutinaHoy,
        currentTimeOfDay,
        items,
        itemsSet,
      });
    });
  });

  return items;
}

/**
 * Hábitos pendientes para el carrusel "Ahora".
 * Diarios: franjas retrasadas + actual en Ahora; futuras en Luego. Periódicos: adelanto o urgencia.
 * @see agendaTerminology — habitSlot.ahora
 */
export function getCarouselAhoraItems(params) {
  return collectCarouselItems('ahora', params);
}

/**
 * Hábitos para el carrusel "Luego".
 * Diarios: franjas futuras hoy. Periódicos: backlog o ventana pasada.
 * @see agendaTerminology — habitSlot.luego
 */
export function getCarouselLuegoItems(params) {
  return collectCarouselItems('luego', params);
}

/**
 * Tracker: mostrar todos los hábitos activos (completados o no).
 */
export function shouldShowInTracker(section, itemId, rutina, config) {
  if (!section || !itemId) return false;
  const itemConfig = config || rutina?.config?.[section]?.[itemId];
  if (itemConfig?.activo === false) return false;
  return true;
}

export function getCarouselItemsForMode(mode, params) {
  if (mode === 'luego') {
    return getCarouselLuegoItems(params);
  }
  return getCarouselAhoraItems(params);
}

function appendCompletedDailyEntries({
  section,
  itemId,
  horarios,
  itemValue,
  items,
  itemsSet,
}) {
  const normalizedHorarios = Array.isArray(horarios)
    ? horarios.map((h) => String(h).toUpperCase()).filter(Boolean)
    : [];

  if (normalizedHorarios.length > 0) {
    normalizedHorarios.forEach((horario) => {
      if (!isHabitHorarioCompleted(itemValue, horario)) return;
      const slotKey = `${section}.${itemId}.${horario}`;
      if (itemsSet.has(slotKey)) return;
      items.push(buildCarouselEntry(section, itemId, horario));
      itemsSet.add(slotKey);
    });
    return;
  }

  if (!isHabitCompletedForHistorial(itemValue)) return;
  const itemKey = `${section}.${itemId}`;
  if (itemsSet.has(itemKey)) return;
  items.push(buildCarouselEntry(section, itemId));
  itemsSet.add(itemKey);
}

/**
 * Hábitos marcados como completados hoy (para panel colapsable en Tareas).
 * @deprecated Prefer getRutinaMarkedDoneTodayEntries + mapRutinaDoneEntriesToCarouselItems.
 */
export function getCarouselCompletedTodayItems({
  rutinaHoy,
  sectionIconsMap,
  habits,
  habitsPreferences = {},
}) {
  const items = [];
  const itemsSet = new Set();
  if (!rutinaHoy) return items;

  HABIT_SECTIONS.forEach((section) => {
    const sectionIcons = sectionIconsMap.iconsMap[section] || {};
    const itemIds = getCarouselSectionItemIds(section, sectionIconsMap.iconsMap, habits);

    itemIds.forEach((itemId) => {
      if (!sectionIcons[itemId]) return;

      const itemConfig = resolveCarouselItemConfig(section, itemId, rutinaHoy, habitsPreferences);
      if (itemConfig.activo === false) return;

      const itemValue = rutinaHoy?.[section]?.[itemId];
      if (!isHabitCompletedForHistorial(itemValue)) return;

      const { tipo, periodo } = normalizeTipoPeriodo(itemConfig);
      const horarios = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];

      if (isDailyTipo(tipo, periodo)) {
        appendCompletedDailyEntries({
          section,
          itemId,
          horarios,
          itemValue,
          items,
          itemsSet,
        });
        return;
      }

      if (!isPeriodicTipo(tipo, periodo)) return;

      const itemKey = `${section}.${itemId}`;
      if (itemsSet.has(itemKey)) return;
      items.push(buildCarouselEntry(section, itemId));
      itemsSet.add(itemKey);
    });
  });

  return items;
}
