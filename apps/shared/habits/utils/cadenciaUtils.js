/**
 * Utilidades para el manejo de cadencia en rutinas.
 *
 * Semana: lun–dom (`CADENCIA_WEEK_STARTS_ON = 1`), alineado con progressUtils,
 * agenda y `getRutinaPeriodStart/End` en rutinaPeriodBounds.
 */

import { addDays, isSameDay, isWithinInterval, getDay, getDate, setDate, 
         startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, 
         differenceInDays, isBefore, parseISO, endOfWeek } from 'date-fns';
import { parseAPIDate, toISODateString } from '../../utils/dateUtils.js';

/** Semana lun–dom; alineado con rutinaPeriodBounds.js. */
export const CADENCIA_WEEK_STARTS_ON = 1;

/**
 * Obtiene el historial de completados de un ítem desde una rutina
 * El historial se estructura como: historial[section][itemId][YYYY-MM-DD] = true
 * @param {string} itemId - ID del ítem
 * @param {string} section - Sección del ítem
 * @param {Object} rutina - Objeto de rutina con historial
 * @returns {Array<Date>} - Array de fechas donde el ítem fue completado
 */
export const obtenerHistorialCompletados = (itemId, section, rutina) => {
  if (!rutina || !rutina.historial || !rutina.historial[section]) {
    return [];
  }

  const historialSection = rutina.historial[section];
  const historialItem = historialSection[itemId];
  
  if (!historialItem) {
    return [];
  }

  // El historial viene como objeto { 'YYYY-MM-DD': true }
  if (typeof historialItem === 'object' && !Array.isArray(historialItem)) {
    return Object.keys(historialItem)
      .filter(fecha => historialItem[fecha] === true)
      .map(fecha => {
        // Parsear fecha YYYY-MM-DD a Date
        const [year, month, day] = fecha.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
      });
  } else if (Array.isArray(historialItem)) {
    // Fallback: si viene como array de fechas
    return historialItem.map(fecha => new Date(fecha));
  }
  
  return [];
};

function normalizeCadenciaDate(targetDate) {
  const fecha = new Date(targetDate);
  fecha.setHours(12, 0, 0, 0);
  return fecha;
}

/**
 * Intervalo de calendario del período activo para una fecha de referencia.
 */
export function getPeriodInterval(fechaObjetivo, tipo, periodo = 'CADA_DIA') {
  const fecha = normalizeCadenciaDate(fechaObjetivo);
  let start;
  let end;

  switch (tipo) {
    case 'SEMANAL':
      start = startOfWeek(fecha, { weekStartsOn: CADENCIA_WEEK_STARTS_ON });
      end = endOfWeek(fecha, { weekStartsOn: CADENCIA_WEEK_STARTS_ON });
      end.setHours(23, 59, 59, 999);
      break;
    case 'MENSUAL':
      start = startOfMonth(fecha);
      end = endOfMonth(fecha);
      end.setHours(23, 59, 59, 999);
      break;
    case 'PERSONALIZADO':
      start = startOfWeek(fecha, { weekStartsOn: CADENCIA_WEEK_STARTS_ON });
      end = endOfWeek(fecha, { weekStartsOn: CADENCIA_WEEK_STARTS_ON });
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start = new Date(fecha);
      start.setHours(0, 0, 0, 0);
      end = new Date(fecha);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/** Rango lun–dom alineado con cadencia y agenda. */
export function getCadenciaWeekRange(fecha) {
  return getPeriodInterval(fecha, 'SEMANAL');
}

/**
 * ¿La fecha es un día programado según diasSemana/diasMes?
 */
export function isScheduledCadenciaDay(fechaObjetivo, cadenciaConfig) {
  if (!cadenciaConfig) return true;

  const tipo = (cadenciaConfig.tipo || 'DIARIO').toUpperCase();
  const periodo = (cadenciaConfig.periodo || 'CADA_DIA').toUpperCase();
  const diasSemana = Array.isArray(cadenciaConfig.diasSemana) ? cadenciaConfig.diasSemana : [];
  const diasMes = Array.isArray(cadenciaConfig.diasMes) ? cadenciaConfig.diasMes : [];
  const fecha = normalizeCadenciaDate(fechaObjetivo);

  if (tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA')) {
    return true;
  }

  if (tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA')) {
    if (diasSemana.length === 0) return true;
    return diasSemana.includes(getDay(fecha));
  }

  if (tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES')) {
    if (diasMes.length === 0) return true;
    return diasMes.includes(getDate(fecha));
  }

  return false;
}

/** PERSONALIZADO sin días fijos (intervalo desde última completación). */
export function isPersonalizedIntervalConfig(cadenciaConfig) {
  if (!cadenciaConfig || cadenciaConfig.activo === false) return false;

  const tipo = (cadenciaConfig.tipo || 'DIARIO').toUpperCase();
  if (tipo !== 'PERSONALIZADO') return false;
  return !resolveFixedPeriodicCadence(cadenciaConfig);
}

/** Días del intervalo para cadencia PERSONALIZADO por periodo. */
export function resolvePersonalizedIntervalDays(cadenciaConfig) {
  const frecuencia = Number(cadenciaConfig?.frecuencia || 1);
  const periodo = (cadenciaConfig?.periodo || 'CADA_DIA').toUpperCase();

  switch (periodo) {
    case 'CADA_SEMANA':
      return frecuencia * 7;
    case 'CADA_MES':
      return frecuencia * 30;
    case 'CADA_TRIMESTRE':
      return frecuencia * 90;
    case 'CADA_SEMESTRE':
      return frecuencia * 180;
    case 'CADA_ANO':
    case 'CADA_AÑO':
      return frecuencia * 365;
    default:
      return frecuencia;
  }
}

/**
 * ¿Hábito PERSONALIZADO en período de descanso tras completar (p. ej. cada 4 días)?
 * No aplica a periódicos con días fijos (diasSemana/diasMes).
 */
export function isIntervalCadenceResting(fechaObjetivo, cadenciaConfig, historialCompletado = []) {
  if (!isPersonalizedIntervalConfig(cadenciaConfig)) return false;

  const ultimaCompletacion = obtenerUltimaCompletacion(historialCompletado);
  if (!ultimaCompletacion) return false;

  const fecha = normalizeCadenciaDate(fechaObjetivo);
  const diasIntervalo = resolvePersonalizedIntervalDays(cadenciaConfig);

  return differenceInDays(fecha, ultimaCompletacion) < diasIntervalo;
}

function resolveFixedPeriodicCadence(cadenciaConfig) {
  if (!cadenciaConfig) return null;

  const tipo = (cadenciaConfig.tipo || 'DIARIO').toUpperCase();
  const periodo = (cadenciaConfig.periodo || 'CADA_DIA').toUpperCase();
  const diasSemana = Array.isArray(cadenciaConfig.diasSemana) ? cadenciaConfig.diasSemana : [];
  const diasMes = Array.isArray(cadenciaConfig.diasMes) ? cadenciaConfig.diasMes : [];

  if (tipo === 'SEMANAL' && diasSemana.length > 0) {
    return { countTipo: 'SEMANAL', scheduledDays: diasSemana, dayMatcher: getDay };
  }
  if (tipo === 'MENSUAL' && diasMes.length > 0) {
    return { countTipo: 'MENSUAL', scheduledDays: diasMes, dayMatcher: getDate };
  }
  if (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA' && diasSemana.length > 0) {
    return { countTipo: 'SEMANAL', scheduledDays: diasSemana, dayMatcher: getDay };
  }
  if (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES' && diasMes.length > 0) {
    return { countTipo: 'MENSUAL', scheduledDays: diasMes, dayMatcher: getDate };
  }

  return null;
}

/**
 * Fechas concretas programadas dentro del período activo.
 */
export function getScheduledDatesInPeriod(fechaObjetivo, cadenciaConfig) {
  const fixed = resolveFixedPeriodicCadence(cadenciaConfig);
  if (!fixed) return [];

  const { start, end } = getPeriodInterval(fechaObjetivo, fixed.countTipo);
  const days = eachDayOfInterval({ start, end });
  return days.filter((day) => fixed.scheduledDays.includes(fixed.dayMatcher(day)));
}

/**
 * Deuda de cadencia: cuota pendiente y al menos un día programado del período ya pasó.
 * Solo aplica a periódicos con días fijos (diasSemana/diasMes).
 */
export function hasCadenciaDebt(fechaObjetivo, cadenciaConfig, historialCompletado = []) {
  if (!cadenciaConfig || cadenciaConfig.activo === false) return false;

  const fixed = resolveFixedPeriodicCadence(cadenciaConfig);
  if (!fixed) return false;

  const fecha = normalizeCadenciaDate(fechaObjetivo);
  const frecuencia = Number(cadenciaConfig.frecuencia || 1);
  const periodo = cadenciaConfig.periodo || 'CADA_DIA';
  const completadosEnPeriodo = contarCompletadosEnPeriodo(
    fecha,
    fixed.countTipo,
    periodo,
    historialCompletado,
  );

  if (completadosEnPeriodo >= frecuencia) return false;

  const scheduledDates = getScheduledDatesInPeriod(fecha, cadenciaConfig);
  return scheduledDates.some((scheduledDate) => {
    const normalized = normalizeCadenciaDate(scheduledDate);
    return isBefore(normalized, fecha) && !isSameDay(normalized, fecha);
  });
}

/**
 * Determina si un día específico debe mostrar un hábito según su configuración de cadencia
 */
export const debesMostrarHabitoEnFecha = (targetDate, cadenciaConfig, historialCompletado = []) => {
  if (!cadenciaConfig) return true;
  if (cadenciaConfig.activo === false) return false;

  const fechaObjetivo = new Date(targetDate);
  fechaObjetivo.setHours(12, 0, 0, 0);
  
  const tipo = (cadenciaConfig.tipo || 'DIARIO').toUpperCase();
  const frecuencia = Number(cadenciaConfig.frecuencia || 1);
  const diasSemana = Array.isArray(cadenciaConfig.diasSemana) ? cadenciaConfig.diasSemana : [];
  const diasMes = Array.isArray(cadenciaConfig.diasMes) ? cadenciaConfig.diasMes : [];
  const periodo = cadenciaConfig.periodo || 'CADA_DIA';

  const completadosEnPeriodo = contarCompletadosEnPeriodo(
    fechaObjetivo, 
    tipo, 
    periodo, 
    historialCompletado
  );

  if (completadosEnPeriodo >= frecuencia) {
    return false;
  }

  switch (tipo) {
    case 'DIARIO':
      return true;

    case 'SEMANAL':
      if (diasSemana.length > 0) {
        const diaSemana = getDay(fechaObjetivo);
        if (diasSemana.includes(diaSemana)) return true;
        return hasCadenciaDebt(fechaObjetivo, cadenciaConfig, historialCompletado);
      }
      return true;

    case 'MENSUAL':
      if (diasMes.length > 0) {
        const diaMes = getDate(fechaObjetivo);
        if (diasMes.includes(diaMes)) return true;
        return hasCadenciaDebt(fechaObjetivo, cadenciaConfig, historialCompletado);
      }
      return true;

    case 'PERSONALIZADO': {
      // Con días fijos (diasSemana/diasMes): misma semántica que SEMANAL/MENSUAL.
      const fixed = resolveFixedPeriodicCadence(cadenciaConfig);
      if (fixed) {
        const dayVal = fixed.dayMatcher(fechaObjetivo);
        if (fixed.scheduledDays.includes(dayVal)) return true;
        return hasCadenciaDebt(fechaObjetivo, cadenciaConfig, historialCompletado);
      }

      // Sin días fijos: intervalo desde la última completación.
      const ultimaCompletacion = obtenerUltimaCompletacion(historialCompletado);

      if (!ultimaCompletacion) {
        return true;
      }

      return differenceInDays(
        fechaObjetivo,
        ultimaCompletacion,
      ) >= resolvePersonalizedIntervalDays(cadenciaConfig);
    }

    default:
      return true;
  }
};

export const contarCompletadosEnPeriodo = (fechaObjetivo, tipo, periodo, historialCompletado) => {
  if (!historialCompletado || historialCompletado.length === 0) {
    return 0;
  }

  const historialNormalizado = historialCompletado.map(fecha => {
    const fechaNormalizada = new Date(fecha);
    fechaNormalizada.setHours(12, 0, 0, 0);
    return fechaNormalizada;
  });

  let inicioIntervalo;
  let finIntervalo;

  switch (tipo) {
    case 'DIARIO': {
      const interval = getPeriodInterval(fechaObjetivo, 'DIARIO');
      inicioIntervalo = interval.start;
      finIntervalo = interval.end;
      break;
    }

    case 'SEMANAL': {
      const interval = getPeriodInterval(fechaObjetivo, 'SEMANAL');
      inicioIntervalo = interval.start;
      finIntervalo = interval.end;
      break;
    }

    case 'MENSUAL': {
      const interval = getPeriodInterval(fechaObjetivo, 'MENSUAL');
      inicioIntervalo = interval.start;
      finIntervalo = interval.end;
      break;
    }

    case 'PERSONALIZADO': {
      const ultimaCompletacion = obtenerUltimaCompletacion(historialCompletado);
      
      if (!ultimaCompletacion) {
        return 0;
      }
      
      inicioIntervalo = ultimaCompletacion;
      finIntervalo = fechaObjetivo;
      break;
    }

    default:
      inicioIntervalo = new Date(fechaObjetivo);
      inicioIntervalo.setHours(0, 0, 0, 0);
      finIntervalo = new Date(fechaObjetivo);
      finIntervalo.setHours(23, 59, 59, 999);
  }

  return historialNormalizado.filter(fecha => 
    isWithinInterval(fecha, { 
      start: inicioIntervalo, 
      end: finIntervalo 
    })
  ).length;
};

export const obtenerUltimaCompletacion = (historialCompletado) => {
  if (!historialCompletado || historialCompletado.length === 0) {
    return null;
  }

  const fechas = historialCompletado.map(fecha => {
    if (typeof fecha === 'string') {
      return parseISO(fecha);
    }
    return new Date(fecha);
  });

  fechas.sort((a, b) => b - a);

  return fechas[0];
};

/** Nombre legible del tipo de cadencia (sin cuota ni progreso). */
export function getCadenceTypeLabel(config = {}) {
  if (!config || config.activo === false) return 'Inactivo';

  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const frecuencia = Number(config.frecuencia || 1);
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();

  switch (tipo) {
    case 'DIARIO':
      return 'Diario';
    case 'SEMANAL':
      return 'Semanal';
    case 'MENSUAL':
      return 'Mensual';
    case 'PERSONALIZADO':
      if (periodo === 'CADA_DIA') return frecuencia === 1 ? 'Diario' : `Cada ${frecuencia}d`;
      if (periodo === 'CADA_SEMANA') return frecuencia === 1 ? 'Semanal' : `Cada ${frecuencia}s`;
      if (periodo === 'CADA_MES') return frecuencia === 1 ? 'Mensual' : `Cada ${frecuencia}m`;
      return 'Personalizado';
    default:
      return 'Diario';
  }
}

/** Completados del período actual para un ítem de rutina. */
export function resolveHabitCompletadosEnPeriodo({
  itemId,
  section,
  rutina,
  config = {},
  isCompleted = false,
}) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = config.periodo ? config.periodo.toUpperCase() : 'CADA_DIA';

  if (tipo === 'DIARIO') {
    const horariosConfig = Array.isArray(config.horarios) ? config.horarios : [];
    const itemValue = rutina?.[section]?.[itemId];
    const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);

    if (horariosConfig.length > 1 && isObjectFormat) {
      return Object.values(itemValue).filter(Boolean).length;
    }
    return isCompleted ? 1 : 0;
  }

  if (tipo === 'SEMANAL' || tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo !== 'CADA_DIA')) {
    if (!rutina) return isCompleted ? 1 : 0;

    const historial = obtenerHistorialCompletados(itemId, section, rutina);
    const refDate = rutina.fecha ? parseAPIDate(rutina.fecha) : new Date();
    let completados = contarCompletadosEnPeriodo(refDate, tipo, periodo, historial);

    if (isCompleted) {
      const refStr = toISODateString(refDate);
      const yaEstaEnHistorial = historial.some((fecha) => {
        try {
          return toISODateString(fecha) === refStr;
        } catch {
          return false;
        }
      });
      if (!yaEstaEnHistorial) completados += 1;
    }
    return completados;
  }

  return isCompleted ? 1 : 0;
}

/**
 * Etiqueta unificada de cadencia + progreso.
 * Cuota 1 → solo tipo ("Semanal"). Cuota > 1 → "Semanal · 0/3".
 */
export function formatHabitCadenceProgressLabel(config = {}, completados = 0) {
  if (!config || config.activo === false) return 'Inactivo';

  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const frecuencia = Number(config.frecuencia || 1);
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  const horarios = Array.isArray(config.horarios) ? config.horarios : [];

  if (tipo === 'DIARIO' && horarios.length > 0) {
    return getCadenceTypeLabel(config);
  }

  if (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA') {
    return getCadenceTypeLabel(config);
  }

  const typeLabel = getCadenceTypeLabel(config);

  if (frecuencia <= 1) {
    return typeLabel;
  }

  const done = Math.max(0, Math.min(Number(completados) || 0, frecuencia));
  return `${typeLabel} · ${done}/${frecuencia}`;
}

export const generarMensajeCadencia = (cadenciaConfig, historialCompletado = [], fechaActual = new Date()) => {
  if (!cadenciaConfig || !cadenciaConfig.activo) {
    return 'Hábito inactivo';
  }

  const tipo = (cadenciaConfig.tipo || 'DIARIO').toUpperCase();
  const completadosEnPeriodo = contarCompletadosEnPeriodo(
    fechaActual,
    tipo,
    cadenciaConfig.periodo,
    historialCompletado,
  );

  let mensaje = formatHabitCadenceProgressLabel(cadenciaConfig, completadosEnPeriodo);

  if (tipo === 'PERSONALIZADO') {
    const ultimaCompletacion = obtenerUltimaCompletacion(historialCompletado);
    const diasDesdeUltima = ultimaCompletacion
      ? differenceInDays(fechaActual, ultimaCompletacion)
      : null;
    if (diasDesdeUltima !== null) {
      mensaje += `, último hace ${diasDesdeUltima} día(s)`;
    }
  }

  return mensaje;
};

const normalizeFrecuencia = (value) => {
  const stringValue = String(value || '1');
  const parsed = parseInt(stringValue, 10);
  return Number(isNaN(parsed) ? 1 : Math.max(1, parsed));
};

export const getFrecuenciaLabel = (config) => {
  if (!config?.activo) return 'Inactivo';
  
  const frecuencia = normalizeFrecuencia(config.frecuencia || 1);
  const plural = frecuencia > 1 ? 'veces' : 'vez';
  
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = config?.periodo || 'CADA_DIA';
  
  switch (tipo) {
    case 'DIARIO':
      return `${frecuencia} ${plural} por día`;
    case 'SEMANAL':
      if (config.diasSemana && config.diasSemana.length > 0) {
        const diasNames = config.diasSemana
          .map(dia => DIAS_SEMANA.find(d => d.value === dia)?.label.slice(0, 3))
          .filter(Boolean)
          .join(', ');
        return `${frecuencia} ${plural}/sem (${diasNames})`;
      }
      return `${frecuencia} ${plural} por semana`;
    case 'MENSUAL':
      if (config.diasMes && config.diasMes.length > 0) {
        if (config.diasMes.length <= 3) {
          return `${frecuencia} ${plural}/mes (días ${config.diasMes.join(', ')})`;
        } else {
          return `${frecuencia} ${plural}/mes (${config.diasMes.length} días)`;
        }
      }
      return `${frecuencia} ${plural} por mes`;
    case 'TRIMESTRAL':
      return `${frecuencia} ${plural} por trimestre`;
    case 'SEMESTRAL':
      return `${frecuencia} ${plural} por semestre`;
    case 'ANUAL':
      return `${frecuencia} ${plural} por año`;
    case 'PERSONALIZADO':
      if (periodo === 'CADA_DIA') {
        return `Cada ${frecuencia} días`;
      } else if (periodo === 'CADA_SEMANA') {
        return `Cada ${frecuencia} semanas`;
      } else if (periodo === 'CADA_MES') {
        return `Cada ${frecuencia} meses`;
      } else if (periodo === 'CADA_TRIMESTRE') {
        return `Cada ${frecuencia} trimestres`;
      } else if (periodo === 'CADA_SEMESTRE') {
        return `Cada ${frecuencia} semestres`;
      } else if (periodo === 'CADA_ANO') {
        return `Cada ${frecuencia} años`;
      }
      return `Personalizado: ${frecuencia} ${periodo.toLowerCase()}`;
    default:
      return `${frecuencia} ${plural} por día`;
  }
};

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }
];

export const formatearSemana = (fecha) => {
  if (!fecha) return 'Semana desconocida';
  
  try {
    const { start: inicio, end: fin } = getCadenciaWeekRange(fecha);
    const diaInicio = inicio.getDate();
    const diaFin = fin.getDate();
    const mes = fin.toLocaleDateString('es', { month: 'short' });
    const año = fin.getFullYear();
    
    return `Semana ${diaInicio}-${diaFin} ${mes} ${año}`;
  } catch (error) {
    console.error('Error al formatear semana:', error);
    return 'Semana inválida';
  }
};

export default {
  debesMostrarHabitoEnFecha,
  contarCompletadosEnPeriodo,
  obtenerUltimaCompletacion,
  generarMensajeCadencia,
  getCadenceTypeLabel,
  resolveHabitCompletadosEnPeriodo,
  formatHabitCadenceProgressLabel,
  getFrecuenciaLabel,
  formatearSemana,
  getPeriodInterval,
  getCadenciaWeekRange,
  isScheduledCadenciaDay,
  getScheduledDatesInPeriod,
  hasCadenciaDebt,
  isIntervalCadenceResting,
  isPersonalizedIntervalConfig,
  resolvePersonalizedIntervalDays,
};
