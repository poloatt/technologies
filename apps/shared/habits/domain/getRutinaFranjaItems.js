import { getSectionCarouselItems } from '../desktop/rutinaDesktopUtils.js';
import { isHabitHorarioCompleted } from './habitCompletionUtils.js';

function isDailyCadence(config) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  return tipo === 'DIARIO' || periodo === 'CADA_DIA';
}

/**
 * Expande hábitos de una sección en entradas por franja (repetición diaria).
 * Alineado con carrusel: cada franja configurada es una unidad de completado.
 */
export function getRutinaFranjaItems({
  section,
  rutina,
  habits = null,
  habitsPreferences = null,
}) {
  const baseItems = getSectionCarouselItems({
    section,
    rutina,
    habits,
    habitsPreferences,
  });

  const expanded = [];

  baseItems.forEach((entry) => {
    const horarios = Array.isArray(entry.config?.horarios) ? entry.config.horarios : [];

    if (isDailyCadence(entry.config) && horarios.length > 0) {
      horarios.forEach((horario) => {
        const normalized = String(horario).toUpperCase();
        expanded.push({
          ...entry,
          horario: normalized,
          horarioCompleted: isHabitHorarioCompleted(entry.itemValue, normalized),
        });
      });
      return;
    }

    expanded.push({
      ...entry,
      horario: null,
      horarioCompleted: null,
    });
  });

  return expanded;
}
