/**
 * Inicio/fin de período para progreso en schema Rutinas (Mongoose).
 * Semana lunes–domingo (`weekStartsOn: 1`), alineado con cadenciaUtils / agenda.
 */

import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';

const WEEK_OPTS = { weekStartsOn: 1 };

export function getRutinaPeriodStart(config, fecha) {
  const fechaBase = new Date(fecha);

  switch (config?.tipo) {
    case 'SEMANAL':
      return startOfWeek(fechaBase, WEEK_OPTS);
    case 'MENSUAL':
      return startOfMonth(fechaBase);
    default:
      fechaBase.setHours(0, 0, 0, 0);
      return fechaBase;
  }
}

export function getRutinaPeriodEnd(config, fecha) {
  const fechaBase = new Date(fecha);

  switch (config?.tipo) {
    case 'SEMANAL':
      return endOfWeek(fechaBase, WEEK_OPTS);
    case 'MENSUAL':
      return endOfMonth(fechaBase);
    default:
      fechaBase.setHours(23, 59, 59, 999);
      return fechaBase;
  }
}
