/**
 * Utilidades para el manejo de cadencia en rutinas.
 *
 * Semana: lun–dom (`CADENCIA_WEEK_STARTS_ON = 1`), alineado con progressUtils y agenda.
 * Distinto de `@shared/habits` `getRutinaPeriodStart/End` (dom–sáb, legacy schema Rutinas).
 */

import { addDays, isSameDay, isWithinInterval, getDay, getDate, setDate, 
         startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, 
         differenceInDays, isBefore, parseISO, endOfWeek } from 'date-fns';

/** Semana lun–dom; ver rutinaPeriodBounds.js para dom–sáb (schema Rutinas). */
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
      const ultimaCompletacion = obtenerUltimaCompletacion(historialCompletado);
      
      if (!ultimaCompletacion) {
        return true;
      }
      
      let diasIntervalo = frecuencia;
      
      switch (periodo) {
        case 'CADA_SEMANA':
          diasIntervalo = frecuencia * 7;
          break;
        case 'CADA_MES':
          diasIntervalo = frecuencia * 30;
          break;
        case 'CADA_TRIMESTRE':
          diasIntervalo = frecuencia * 90;
          break;
        case 'CADA_SEMESTRE':
          diasIntervalo = frecuencia * 180;
          break;
        case 'CADA_ANO':
          diasIntervalo = frecuencia * 365;
          break;
      }
      
      const diasDesdeUltimaCompletacion = differenceInDays(
        fechaObjetivo,
        ultimaCompletacion
      );
      
      return diasDesdeUltimaCompletacion >= diasIntervalo;
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

export const generarMensajeCadencia = (cadenciaConfig, historialCompletado = [], fechaActual = new Date()) => {
  if (!cadenciaConfig || !cadenciaConfig.activo) {
    return 'Hábito inactivo';
  }

  const tipo = (cadenciaConfig.tipo || 'DIARIO').toUpperCase();
  const frecuencia = Number(cadenciaConfig.frecuencia || 1);
  const completadosEnPeriodo = contarCompletadosEnPeriodo(
    fechaActual, 
    tipo, 
    cadenciaConfig.periodo, 
    historialCompletado
  );

  const ultimaCompletacion = obtenerUltimaCompletacion(historialCompletado);
  const diasDesdeUltima = ultimaCompletacion ? 
    differenceInDays(fechaActual, ultimaCompletacion) : 
    null;

  let mensaje = '';

  switch (tipo) {
    case 'DIARIO':
      mensaje = `${completadosEnPeriodo}/${frecuencia} completados hoy`;
      break;
    case 'SEMANAL':
      mensaje = `${completadosEnPeriodo}/${frecuencia} completados esta semana`;
      break;
    case 'MENSUAL':
      mensaje = `${completadosEnPeriodo}/${frecuencia} completados este mes`;
      break;
    case 'PERSONALIZADO':
      mensaje = `${completadosEnPeriodo}/${frecuencia} completados`;
      if (diasDesdeUltima !== null) {
        mensaje += `, último hace ${diasDesdeUltima} día(s)`;
      }
      break;
    default:
      mensaje = `${completadosEnPeriodo}/${frecuencia} completados en período actual`;
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
  getFrecuenciaLabel,
  formatearSemana,
  getPeriodInterval,
  getCadenciaWeekRange,
  isScheduledCadenciaDay,
  getScheduledDatesInPeriod,
  hasCadenciaDebt,
};
