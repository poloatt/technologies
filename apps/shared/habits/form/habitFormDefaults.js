import { normalizeTimeOfDay } from '../../utils/timeOfDayUtils.js';
import { HABIT_SECTIONS } from '../domain/habitSectionIds.js';
import { RUTINA_SECTION_LABELS } from '../desktop/rutinaDesktopUtils.js';

export const HABIT_SECTION_OPTIONS = HABIT_SECTIONS.map((value) => ({
  value,
  label: RUTINA_SECTION_LABELS[value] || value,
}));

export const DEFAULT_HABIT_CONFIG = {
  tipo: 'DIARIO',
  frecuencia: 1,
  activo: true,
  periodo: 'CADA_DIA',
  diasSemana: [],
  diasMes: [],
  horarios: [],
};

export function normalizeHabitConfig(config) {
  const c = config || DEFAULT_HABIT_CONFIG;
  return {
    tipo: (c.tipo || 'DIARIO').toUpperCase(),
    frecuencia: Number(c.frecuencia || 1),
    activo: c.activo !== false,
    periodo: c.periodo || 'CADA_DIA',
    diasSemana: Array.isArray(c.diasSemana) ? [...c.diasSemana] : [],
    diasMes: Array.isArray(c.diasMes) ? [...c.diasMes] : [],
    horarios: normalizeTimeOfDay(c.horarios),
    esPreferenciaUsuario: true,
    ultimaActualizacion: new Date().toISOString(),
  };
}
