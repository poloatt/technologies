import { debesMostrarHabitoEnFecha, obtenerHistorialCompletados } from './cadenciaUtils.js';
import { parseAPIDate, toISODateString, getNormalizedToday } from '../../utils/dateUtils.js';
import { getCurrentTimeOfDay } from '../../utils/timeOfDayUtils.js';
import { shouldShowHabitForCurrentTime } from './habitTimeLogic.js';
import { isHabitCompletedForHistorial, isHabitFullyCompletedToday } from '../domain/habitCompletionUtils.js';

/**
 * Determina sincrónicamente si un ítem debe mostrarse para una rutina dada.
 * Usa una heurística basada en cadencia (sin llamadas async) para mantener la UI fluida.
 * Si se provee historial en additionalData, se considera para frecuencia/período.
 * Si se provee currentTimeOfDay en additionalData, se filtra por horario configurado.
 */
export default function shouldShowItem(section, itemId, rutina, additionalData = {}) {
  try {
    if (!section || !itemId || !rutina) return false;

    const config = rutina?.config?.[section]?.[itemId];
    if (!config) return true;
    if (config.activo === false) return false;

    const fechaRutina = parseAPIDate(rutina.fecha) || new Date();

    if (
      !additionalData.skipHorarioFilter
      && config.horarios
      && Array.isArray(config.horarios)
      && config.horarios.length > 0
    ) {
      const currentTimeOfDay = additionalData.currentTimeOfDay || getCurrentTimeOfDay();

      const hoy = getNormalizedToday();
      const esHoy = toISODateString(fechaRutina) === toISODateString(hoy);

      if (esHoy) {
        const itemValue = rutina?.[section]?.[itemId];
        const isCompletedToday = itemValue !== undefined ? itemValue : (additionalData.isCompleted || false);

        const tipo = (config.tipo || 'DIARIO').toUpperCase();
        const frecuencia = Number(config.frecuencia || 1);

        if (!shouldShowHabitForCurrentTime(config.horarios, currentTimeOfDay, isCompletedToday, tipo, frecuencia)) {
          return false;
      }
      } else {
        if (!shouldShowHabitForCurrentTime(config.horarios, currentTimeOfDay, false, 'DIARIO', 1)) {
          return false;
        }
      }
    }

    const tipo = (config.tipo || 'DIARIO').toUpperCase();
    const frecuencia = Number(config.frecuencia || 1);
    const progresoActual = Number(config.progresoActual || config.progress || 0);
    const ultimoPeriodo = config.ultimoPeriodo;
    const itemValueForProgress = rutina?.[section]?.[itemId];
    const horariosConfig = Array.isArray(config.horarios) ? config.horarios : [];

    const hideByProgress = () => {
      if (tipo === 'DIARIO') {
        return isHabitFullyCompletedToday(itemValueForProgress, horariosConfig);
      }
      return true;
    };

    if (ultimoPeriodo && ultimoPeriodo.inicio && ultimoPeriodo.fin) {
      const inicio = new Date(ultimoPeriodo.inicio);
      const fin = new Date(ultimoPeriodo.fin);
      if (fechaRutina >= inicio && fechaRutina <= fin) {
        if (progresoActual >= frecuencia && hideByProgress()) {
          return false;
        }
      }
    } else if (progresoActual >= frecuencia) {
      if (tipo === 'DIARIO' && hideByProgress()) {
        return false;
      }
    }

    let historial = [];
    const sectionHist = additionalData?.historial?.[section];
    const itemHist = sectionHist?.[itemId];
    if (Array.isArray(itemHist)) {
      historial = itemHist.map((d) => new Date(d));
    } else if (itemHist && typeof itemHist === 'object') {
      historial = Object.entries(itemHist)
        .filter(([, completed]) => completed === true)
        .map(([dateStr]) => parseAPIDate(dateStr) || new Date(dateStr));
    } else if (sectionHist && typeof sectionHist === 'object') {
      historial = Object.entries(sectionHist)
        .filter(([, items]) => items && items[itemId] === true)
        .map(([dateStr]) => parseAPIDate(dateStr) || new Date(dateStr));
    } else {
      historial = [...obtenerHistorialCompletados(itemId, section, rutina)];
    }
    const itemValue = rutina?.[section]?.[itemId];
    if (isHabitCompletedForHistorial(itemValue)) {
      historial.push(fechaRutina);
    }

    return debesMostrarHabitoEnFecha(fechaRutina, config, historial);
  } catch (error) {
    console.error('[shouldShowItem] Error evaluando visibilidad:', error);
    return true;
  }
}
