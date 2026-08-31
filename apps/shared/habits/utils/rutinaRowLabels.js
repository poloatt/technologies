import { getTimeOfDayLabel } from '../../utils/timeOfDayUtils.js';
import { HABIT_PERIODIC_COPY } from '../../copy/agendaTerminology.js';
import { resolveEntryFranjaFocusHorario } from '../desktop/rutinaCadenceUtils.js';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
} from '../domain/habitCompletionUtils.js';
import {
  formatHabitCadenceProgressLabel,
  getCadenceTypeLabel,
  resolveHabitCompletadosEnPeriodo,
} from './cadenciaUtils.js';

function isDailyCadenceConfig(config = {}) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
}

function resolveEntryCompleted(entry, { rutina, section, localData, localDataBySection } = {}) {
  const entrySection = entry?.section || section;
  const localDataForEntry = localDataBySection?.[entrySection] || localData;
  const itemValue = localDataForEntry?.[entry?.itemId] !== undefined
    ? localDataForEntry[entry.itemId]
    : rutina?.[entrySection]?.[entry?.itemId];
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  return focusHorario
    ? isHabitHorarioCompleted(itemValue, focusHorario)
    : isHabitCompletedForHistorial(itemValue);
}

/**
 * Leyenda secundaria de cadencia/franja para filas de rutina en /rutinas.
 * Prioriza Semanal/Mensual; en diarios con franja → "Cada mañana", etc.
 */
export function resolveRutinaScheduleLegend({
  config = {},
  franjaKey = null,
  focusHorario = null,
  isCadenciaDebt = false,
  rutina = null,
  section = null,
  itemId = null,
  isCompleted = false,
} = {}) {
  if (isCadenciaDebt) return HABIT_PERIODIC_COPY.cadenciaDebt;

  if (!isDailyCadenceConfig(config)) {
    const completados = resolveHabitCompletadosEnPeriodo({
      itemId,
      section,
      rutina,
      config,
      isCompleted,
    });
    return formatHabitCadenceProgressLabel(config, completados);
  }

  const franja = focusHorario || franjaKey;
  if (franja && String(franja).toUpperCase() !== 'GENERAL') {
    const franjaLabel = getTimeOfDayLabel(franja);
    return `Cada ${franjaLabel.toLowerCase()}`;
  }

  return getCadenceTypeLabel(config);
}

/** Leyenda secundaria para una fila apilada (rutina con varios iconos). */
export function resolveRutinaStackScheduleLegend(
  entries = [],
  { rutina = null, section = null, localData = null, localDataBySection = null } = {},
) {
  if (!entries.length) return '';

  for (const entry of entries) {
    const config = entry?.config || {};
    if (!isDailyCadenceConfig(config)) {
      const entrySection = entry.section || section;
      return resolveRutinaScheduleLegend({
        config,
        isCadenciaDebt: entry.isCadenciaDebt,
        rutina,
        section: entrySection,
        itemId: entry.itemId,
        isCompleted: resolveEntryCompleted(entry, {
          rutina,
          section,
          localData,
          localDataBySection,
        }),
      });
    }
  }

  const ref = entries[0];
  const entrySection = ref.section || section;
  return resolveRutinaScheduleLegend({
    config: ref.config,
    franjaKey: ref.franjaKey,
    focusHorario: resolveEntryFranjaFocusHorario(ref),
    isCadenciaDebt: ref.isCadenciaDebt,
    rutina,
    section: entrySection,
    itemId: ref.itemId,
    isCompleted: resolveEntryCompleted(ref, {
      rutina,
      section,
      localData,
      localDataBySection,
    }),
  });
}
