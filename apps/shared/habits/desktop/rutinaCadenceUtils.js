import { resolveHabitSections, resolveSectionLabel } from '../domain/resolveHabitSections.js';
import { resolveRutinaItemConfig } from '../domain/resolveRutinaItemConfig.js';
import {
  RUTINA_CADENCE_BUCKETS,
  resolveHabitCadenceBucket,
  CADENCE_BUCKET_ICON_KEYS,
} from '../utils/habitCadenceBuckets.js';
import { VALID_TIME_OF_DAY, getTimeOfDayLabel, getCurrentTimeOfDay } from '../../utils/timeOfDayUtils.js';
import { getNormalizedToday, parseAPIDate } from '../../utils/dateUtils.js';
import { isSameDay, startOfDay } from 'date-fns';
import {
  getSectionCarouselItems,
  groupSectionHabitsByDaySchedule,
  sortSectionCarouselBySlot,
  sortSectionHabitsByFixedOrder,
  resolveRutinaScheduleBucket,
  isEntryDueOnRutinaDay,
} from './rutinaDesktopUtils.js';
import { isHabitHorarioCompleted } from '../domain/habitCompletionUtils.js';
import { getRutinaDayMode } from '../../utils/rutinaDayMode.js';
import { DIAS_SEMANA } from '../utils/cadenciaUtils.js';
import { DAILY_CADENCE_SECTION_COPY, RUTINA_DAY_GROUP_COPY } from '../../copy/agendaTerminology.js';
import { isFranjaPostponed } from '../utils/rutinaPostponeUtils.js';

/** Lunes → Domingo. */
export const WEEKDAY_ORDER = [...DIAS_SEMANA.slice(1), DIAS_SEMANA[0]];

/** Deduplica entradas multi-sección por section:itemId (p. ej. Hecho global). */
export function dedupeCadenceEntries(items = []) {
  const seen = new Set();
  return items.filter((entry) => {
    const key = `${entry.section}:${entry.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Solo Diario usa subgrupos por franja horaria. */
export const CADENCE_BUCKETS_WITH_FRANJA = ['DIARIO'];

export function bucketUsesFranjaLayout(bucketId) {
  return CADENCE_BUCKETS_WITH_FRANJA.includes(bucketId);
}

/** Semanal agrupa por día de la semana (Lunes, Martes, …). */
export const CADENCE_BUCKETS_WITH_WEEKDAY = ['SEMANAL'];

export function bucketUsesWeekdayLayout(bucketId) {
  return CADENCE_BUCKETS_WITH_WEEKDAY.includes(bucketId);
}

export { CADENCE_BUCKET_ICON_KEYS };

/** Orden de franjas horarias en el bucket Diario (GENERAL legacy solo para ordenar). */
export const DAILY_CADENCE_FRANJA_ORDER = [...VALID_TIME_OF_DAY, 'GENERAL'];

const DAILY_FRANJA_HEADINGS = {
  MAÑANA: 'Esta mañana',
  TARDE: 'Esta tarde',
  NOCHE: 'Esta noche',
  GENERAL: 'Todo el día',
};

function isDailyCadenceConfig(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function resolveEntryDailyFranjas(config = {}, activeFranja = 'MAÑANA') {
  const horarios = Array.isArray(config.horarios) ? config.horarios : [];
  const normalized = horarios
    .map((horario) => String(horario).toUpperCase())
    .filter((horario) => VALID_TIME_OF_DAY.includes(horario));

  if (normalized.length === 0) return [activeFranja];

  return [...new Set(normalized)].sort(
    (a, b) => DAILY_CADENCE_FRANJA_ORDER.indexOf(a) - DAILY_CADENCE_FRANJA_ORDER.indexOf(b),
  );
}

/** True si el hábito tiene franjas horarias configuradas (MAÑANA/TARDE/NOCHE). */
export function entryHasConfiguredDailyFranjas(config = {}) {
  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  return horarios
    .map((horario) => String(horario).toUpperCase())
    .some((horario) => VALID_TIME_OF_DAY.includes(horario));
}

/** Horario de UI para un ítem en bucket Diario (null si solo está ubicado por franja activa). */
export function resolveEntryFranjaFocusHorario(entry) {
  const franjaKey = entry?.franjaKey;
  if (!franjaKey || franjaKey === 'GENERAL') return null;
  if (!entryHasConfiguredDailyFranjas(entry?.config)) return null;
  return franjaKey;
}

function getDailyFranjaHeading(franjaKey, rutina) {
  const isToday = !rutina?.fecha || getRutinaDayMode(rutina.fecha) === 'today';
  if (isToday) {
    return DAILY_FRANJA_HEADINGS[franjaKey] || getTimeOfDayLabel(franjaKey);
  }
  return getTimeOfDayLabel(franjaKey);
}

/** ¿La rutina corresponde al día de hoy (títulos "Esta mañana" y lista activa)? */
export function isViewingRutinaToday(rutina) {
  return !rutina?.fecha || getRutinaDayMode(rutina.fecha) === 'today';
}

/** Franja horaria activa según la hora actual (o MAÑANA en días históricos/futuros). */
export function resolveActiveDailyFranja(rutina) {
  if (!rutina?.fecha) return 'MAÑANA';
  try {
    const rutinaDate = startOfDay(parseAPIDate(rutina.fecha));
    const isViewingToday = isSameDay(rutinaDate, getNormalizedToday());
    if (!isViewingToday) return 'MAÑANA';
    return getCurrentTimeOfDay();
  } catch {
    return 'MAÑANA';
  }
}

function resolveFranjaScheduleBucket(entry, franjaKey, rutina) {
  if (franjaKey !== 'GENERAL') {
    if (isHabitHorarioCompleted(entry.itemValue, franjaKey)) {
      return 'done';
    }
    if (resolveRutinaScheduleBucket(entry, { rutina }) === 'done') {
      return 'done';
    }
    if (!isEntryDueOnRutinaDay(entry, rutina)) {
      return 'notToday';
    }
    return 'today';
  }
  return resolveRutinaScheduleBucket(entry, { rutina });
}

/**
 * Agrupa ítems del bucket Diario por franja horaria (Esta mañana, Esta tarde, …).
 * Cada entrada incluye `franjaKey` para renderizar un solo icon button por fila.
 */
export function groupDailyCadenceByFranja(bucket, rutina) {
  const activeFranja = resolveActiveDailyFranja(rutina);
  const franjaMap = Object.fromEntries(
    VALID_TIME_OF_DAY.map((franjaKey) => [franjaKey, { today: [], done: [], notToday: [] }]),
  );

  bucket.items.forEach((entry) => {
    resolveEntryDailyFranjas(entry.config, activeFranja).forEach((franjaKey) => {
      const bucketFranja = franjaMap[franjaKey];
      if (!bucketFranja) return;
      const bucketId = resolveFranjaScheduleBucket({ ...entry, franjaKey }, franjaKey, rutina);
      bucketFranja[bucketId === 'today' ? 'today' : bucketId].push({ ...entry, franjaKey });
    });
  });

  return VALID_TIME_OF_DAY
    .map((franjaKey) => ({
      franjaKey,
      franjaLabel: getDailyFranjaHeading(franjaKey, rutina),
      today: franjaMap[franjaKey].today,
      done: franjaMap[franjaKey].done,
      notToday: franjaMap[franjaKey].notToday,
    }))
    .filter((group) => group.today.length > 0 || group.done.length > 0 || group.notToday.length > 0);
}

/** Combina grupos de franjas (p. ej. Mañana + Tarde pendientes en la noche). */
export function mergeDailyFranjaGroups(...groups) {
  const valid = groups.filter(Boolean);
  if (!valid.length) return null;

  return {
    franjaKey: valid[0].franjaKey,
    franjaLabel: valid[0].franjaLabel,
    today: valid.flatMap((group) => group.today || []),
    notToday: valid.flatMap((group) => group.notToday || []),
    done: valid.flatMap((group) => group.done || []),
  };
}

/** Etiqueta de la franja activa en la vista por grupo (alineada con cadencia). */
export function resolveGroupViewActiveFranjaLabel(activeFranja, rutina) {
  if (!isViewingRutinaToday(rutina)) {
    return RUTINA_DAY_GROUP_COPY.today;
  }
  if (activeFranja === 'TARDE') {
    return DAILY_CADENCE_SECTION_COPY.ahora;
  }
  return getDailyFranjaHeading(activeFranja, rutina);
}

function splitTodayEntryByFranja(entry, activeFranja, rutina = null) {
  const { config, itemValue, section, itemId } = entry;
  const activeIdx = VALID_TIME_OF_DAY.indexOf(activeFranja);
  const sinHacer = [];
  const ahora = [];
  const luego = [];

  if (!isDailyCadenceConfig(config)) {
    ahora.push(entry);
    return { sinHacer, ahora, luego };
  }

  resolveEntryDailyFranjas(config, activeFranja).forEach((franjaKey) => {
    if (isHabitHorarioCompleted(itemValue, franjaKey)) return;

    const enriched = { ...entry, franjaKey };
    const franjaIdx = VALID_TIME_OF_DAY.indexOf(franjaKey);
    const postponed = rutina && isFranjaPostponed(rutina, section, itemId, franjaKey);

    if (postponed) {
      luego.push(enriched);
      return;
    }

    if (franjaIdx < activeIdx) {
      sinHacer.push(enriched);
    } else if (franjaIdx === activeIdx) {
      ahora.push(enriched);
    } else {
      luego.push(enriched);
    }
  });

  return { sinHacer, ahora, luego };
}

function sortMultiSectionCadenceEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const sectionCmp = String(a.sectionLabel || a.section || '')
      .localeCompare(String(b.sectionLabel || b.section || ''), 'es');
    if (sectionCmp !== 0) return sectionCmp;
    return (a.label || '').localeCompare(b.label || '', 'es');
  });
}

/**
 * Agrupa el bucket Diario (multi-sección) con Sin hacer / Ahora / Luego.
 * Mismo criterio de franjas que groupSectionHabitsByFranjaSchedule, a nivel cadencia.
 */
export function groupDailyCadenceBucketByFranjaSchedule(bucket, rutina) {
  const today = bucket?.today || [];
  const done = bucket?.done || [];
  const notToday = bucket?.notToday || [];

  if (!isViewingRutinaToday(rutina)) {
    return {
      sinHacer: [],
      ahora: today,
      luego: [],
      done,
      notToday,
      activeFranja: resolveActiveDailyFranja(rutina),
      activeFranjaLabel: RUTINA_DAY_GROUP_COPY.today,
    };
  }

  const activeFranja = resolveActiveDailyFranja(rutina);
  const sinHacer = [];
  const ahora = [];
  const luego = [];

  today.forEach((entry) => {
    const split = splitTodayEntryByFranja(entry, activeFranja, rutina);
    sinHacer.push(...split.sinHacer);
    ahora.push(...split.ahora);
    luego.push(...split.luego);
  });

  return {
    sinHacer: sortMultiSectionCadenceEntries(sinHacer),
    ahora: sortMultiSectionCadenceEntries(ahora),
    luego: sortMultiSectionCadenceEntries(luego),
    done,
    notToday,
    activeFranja,
    activeFranjaLabel: resolveGroupViewActiveFranjaLabel(activeFranja, rutina),
  };
}

/**
 * Agrupa hábitos de una sección para la vista Grupo con Sin hacer / Ahora / Luego.
 * Extiende groupSectionHabitsByDaySchedule con el mismo criterio de franjas que cadencia.
 */
export function groupSectionHabitsByFranjaSchedule(params) {
  const grouped = groupSectionHabitsByDaySchedule(params);
  const { rutina, section, habits = null } = params;
  const sortOpts = { section, habits };

  if (!isViewingRutinaToday(rutina)) {
    return {
      ...grouped,
      sinHacer: [],
      ahora: grouped.today,
      luego: [],
      activeFranja: resolveActiveDailyFranja(rutina),
      activeFranjaLabel: RUTINA_DAY_GROUP_COPY.today,
    };
  }

  const activeFranja = resolveActiveDailyFranja(rutina);
  const sinHacer = [];
  const ahora = [];
  const luego = [];

  grouped.today.forEach((entry) => {
    const split = splitTodayEntryByFranja(entry, activeFranja, rutina);
    sinHacer.push(...split.sinHacer);
    ahora.push(...split.ahora);
    luego.push(...split.luego);
  });

  return {
    ...grouped,
    sinHacer: sortSectionHabitsByFixedOrder(sinHacer, sortOpts),
    ahora: sortSectionHabitsByFixedOrder(ahora, sortOpts),
    luego: sortSectionHabitsByFixedOrder(luego, sortOpts),
    activeFranja,
    activeFranjaLabel: resolveGroupViewActiveFranjaLabel(activeFranja, rutina),
  };
}

/**
 * Secciones visibles del bucket Diario según la franja activa del día.
 * Mañana → Mañana, Tarde, Noche | Tarde → Mañana, Ahora, Noche | Noche → Sin hacer, Noche.
 */
export function buildDailyCadenceDisplaySections({
  groupsByKey = {},
  activeFranja = 'MAÑANA',
  isViewingToday = true,
  labels = {},
}) {
  const ahoraLabel = labels.ahora || 'Ahora';
  const sinHacerLabel = labels.sinHacer || 'Sin hacer';

  const group = (key) => groupsByKey[key] || null;
  const labelOf = (key) => group(key)?.franjaLabel || getTimeOfDayLabel(key);

  const staticSection = (key, { isActive = false } = {}) => ({
    id: key,
    label: labelOf(key),
    group: group(key),
    isActive,
    franjaKey: key,
  });

  if (!isViewingToday) {
    return VALID_TIME_OF_DAY.map((key) => staticSection(key));
  }

  switch (activeFranja) {
    case 'TARDE':
      return [
        staticSection('MAÑANA'),
        {
          id: 'AHORA',
          label: ahoraLabel,
          group: group('TARDE'),
          isActive: true,
          franjaKey: 'TARDE',
        },
        staticSection('NOCHE'),
      ];
    case 'NOCHE':
      return [
        {
          id: 'SIN_HACER',
          label: sinHacerLabel,
          group: mergeDailyFranjaGroups(group('MAÑANA'), group('TARDE')),
          isActive: false,
          franjaKey: 'SIN_HACER',
        },
        staticSection('NOCHE', { isActive: true }),
      ];
    case 'MAÑANA':
    default:
      return [
        staticSection('MAÑANA', { isActive: true }),
        staticSection('TARDE'),
        staticSection('NOCHE'),
      ];
  }
}

function isWeeklyCadenceConfig(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA');
}

/** Días de la semana configurados para un hábito semanal (0=Dom … 6=Sáb). */
export function resolveEntryWeekdays(config = {}) {
  const diasSemana = Array.isArray(config?.diasSemana) ? config.diasSemana : [];
  const normalized = diasSemana.filter((d) => typeof d === 'number' && d >= 0 && d <= 6);
  if (normalized.length > 0) return [...new Set(normalized)].sort((a, b) => a - b);
  return WEEKDAY_ORDER.map((d) => d.value);
}

/**
 * Bucket de vista por cadencia: lo que toca hoy (incl. semanal/mensual) → Diario.
 * El bucket nativo del hábito no cambia; solo la agrupación en la UI.
 */
export function resolveCadenceViewBucket(entry, rutina) {
  const nativeBucket = resolveHabitCadenceBucket(entry.config);
  if (nativeBucket === 'DIARIO') return 'DIARIO';
  if (isEntryDueOnRutinaDay(entry, rutina)) return 'DIARIO';
  return nativeBucket;
}

/**
 * Agrupa ítems del bucket Semanal por día de la semana (solo hábitos que no tocan hoy).
 */
export function groupWeeklyCadenceByWeekday(bucket, rutina) {
  const weekdayMap = Object.fromEntries(
    WEEKDAY_ORDER.map(({ value }) => [value, { pending: [], done: [] }]),
  );

  bucket.items.forEach((entry) => {
    if (!isWeeklyCadenceConfig(entry.config)) return;

    const scheduleBucket = resolveRutinaScheduleBucket(entry, { rutina });
    const targetKey = scheduleBucket === 'done' ? 'done' : 'pending';

    resolveEntryWeekdays(entry.config).forEach((weekdayKey) => {
      const group = weekdayMap[weekdayKey];
      if (!group) return;
      group[targetKey].push({ ...entry, weekdayKey });
    });
  });

  return WEEKDAY_ORDER
    .map(({ value, label }) => ({
      weekdayKey: value,
      weekdayLabel: label,
      pending: weekdayMap[value].pending,
      done: weekdayMap[value].done,
    }))
    .filter((group) => group.pending.length > 0 || group.done.length > 0);
}

/**
 * Agrupa hábitos activos de todas las secciones por cadencia (Diario, Semanal, …).
 * Solo incluye buckets con al menos un hábito.
 */
export function groupRutinaHabitsByCadence({
  rutina,
  habits = null,
  habitsPreferences = null,
  habitChains = [],
  customSections = [],
  iconsMap = null,
  localDataBySection = {},
}) {
  const bucketsMap = Object.fromEntries(
    RUTINA_CADENCE_BUCKETS.map((bucket) => [bucket.id, []]),
  );

  resolveHabitSections(customSections).forEach((section) => {
    const sectionLocal = localDataBySection?.[section] || {};
    const grouped = groupSectionHabitsByDaySchedule({
      section,
      rutina,
      habits,
      habitsPreferences,
      localData: sectionLocal,
      localDataBySection,
      habitChains,
      iconsMap,
    });

    [...grouped.today, ...grouped.done, ...grouped.notToday].forEach((entry) => {
      if (entry.config?.activo === false) return;
      const bucketId = resolveCadenceViewBucket(entry, rutina);
      bucketsMap[bucketId].push({
        ...entry,
        section,
        sectionLabel: resolveSectionLabel(section, customSections),
      });
    });
  });

  const sectionSortKey = (entry) => String(entry.sectionLabel || entry.section || '');

  return RUTINA_CADENCE_BUCKETS
    .map((bucket) => {
      const items = bucketsMap[bucket.id].sort((a, b) => {
        const sectionCmp = sectionSortKey(a).localeCompare(sectionSortKey(b), 'es');
        if (sectionCmp !== 0) return sectionCmp;
        return (a.label || '').localeCompare(b.label || '', 'es');
      });

      const today = [];
      const done = [];
      const notToday = [];

      items.forEach((entry) => {
        const scheduleBucket = resolveRutinaScheduleBucket(entry, { rutina });
        if (scheduleBucket === 'done') done.push(entry);
        else if (scheduleBucket === 'today') today.push(entry);
        else notToday.push(entry);
      });

      return {
        ...bucket,
        items,
        today,
        done,
        notToday,
      };
    })
    .filter((bucket) => bucket.items.length > 0);
}

export function getCadenceBucketCompletionStats(bucket) {
  const completed = bucket.done?.length
    ?? bucket.items.filter((entry) => entry.isCompleted).length;
  return { completed, total: bucket.items.length };
}

export function getDefaultSelectedCadenceBucket(cadenceBuckets = []) {
  for (const bucket of cadenceBuckets) {
    if (bucket.today?.length > 0) return bucket.id;
  }
  return cadenceBuckets[0]?.id || 'DIARIO';
}

export function getCadenceBucketCarouselItems({
  bucketId,
  rutina,
  habits = null,
  habitsPreferences = null,
  habitChains = [],
  iconsMap = null,
  currentTimeOfDay = 'MAÑANA',
  customSections = [],
}) {
  const combined = [];

  resolveHabitSections(customSections).forEach((section) => {
    getSectionCarouselItems({
      section,
      rutina,
      habits,
      habitsPreferences,
      habitChains,
      iconsMap,
      currentTimeOfDay,
    }).forEach((entry) => {
      const config = resolveRutinaItemConfig(section, entry.itemId, rutina, habitsPreferences);
      const viewEntry = { ...entry, section, config };
      if (resolveCadenceViewBucket(viewEntry, rutina) !== bucketId) return;
      combined.push(viewEntry);
    });
  });

  return sortSectionCarouselBySlot(combined, { habits });
}
