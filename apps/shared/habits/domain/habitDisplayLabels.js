import { habitIdsMatch } from './habitSectionIds.js';

/** Tooltips legacy por sección (sin MUI; alineado con iconConfig.iconTooltips). */
export const LEGACY_HABIT_TOOLTIPS = {
  bodyCare: {
    bath: 'Ducha',
    skinCareDay: 'Cuidado facial día',
    skinCareNight: 'Cuidado facial noche',
    bodyCream: 'Crema corporal',
  },
  nutricion: {
    cocinar: 'Cocinar',
    agua: 'Beber agua',
    protein: 'Proteína',
    meds: 'Medicamentos',
  },
  ejercicio: {
    meditate: 'Meditar',
    stretching: 'Correr',
    gym: 'Gimnasio',
    cardio: 'Bicicleta',
  },
  cleaning: {
    bed: 'Hacer la cama',
    platos: 'Lavar platos',
    piso: 'Limpiar piso',
    ropa: 'Lavar ropa',
  },
};

/** Etiqueta de hábito sin dependencias MUI (Node-safe). */
export function getHabitDisplayLabel(section, itemId, habits = null) {
  if (!section || !itemId) return '';

  const sectionHabits = Array.isArray(habits?.[section]) ? habits[section] : [];
  const custom = sectionHabits.find((h) => habitIdsMatch(h, itemId));
  if (custom?.label) return custom.label;
  if (custom?.name) return custom.name;

  return LEGACY_HABIT_TOOLTIPS?.[section]?.[itemId] || itemId;
}
