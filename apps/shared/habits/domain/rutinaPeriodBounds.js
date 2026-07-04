/**
 * Inicio/fin de período para progreso en schema Rutinas (Mongoose).
 * Semana domingo–sábado (legacy del schema; no cambiar sin migración de datos).
 *
 * Para UI/cadencia/agenda usar cadenciaUtils (`CADENCIA_WEEK_STARTS_ON`, lun–dom).
 */

export function getRutinaPeriodStart(config, fecha) {
  const fechaBase = new Date(fecha);

  switch (config.tipo) {
    case 'SEMANAL':
      fechaBase.setDate(fechaBase.getDate() - fechaBase.getDay());
      break;
    case 'MENSUAL':
      fechaBase.setDate(1);
      break;
    default:
      fechaBase.setHours(0, 0, 0, 0);
  }

  return fechaBase;
}

export function getRutinaPeriodEnd(config, fecha) {
  const fechaBase = new Date(fecha);

  switch (config.tipo) {
    case 'SEMANAL':
      fechaBase.setDate(fechaBase.getDate() - fechaBase.getDay() + 6);
      break;
    case 'MENSUAL':
      fechaBase.setMonth(fechaBase.getMonth() + 1);
      fechaBase.setDate(0);
      break;
    default:
      fechaBase.setHours(23, 59, 59, 999);
  }

  return fechaBase;
}
