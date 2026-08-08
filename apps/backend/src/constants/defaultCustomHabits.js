/**
 * Hábitos precargados para usuarios nuevos (única fuente de verdad en backend).
 * No usar para restablecer hábitos de usuarios existentes.
 */

export const HABIT_SECTION_KEYS = ['bodyCare', 'nutricion', 'ejercicio', 'cleaning'];

export const DEFAULT_CUSTOM_HABITS = {
  bodyCare: [
    { id: 'bath', label: 'Ducha', icon: 'Bathtub', activo: true, orden: 0 },
    { id: 'skinCareDay', label: 'Cuidado facial día', icon: 'PersonOutline', activo: true, orden: 1 },
    { id: 'skinCareNight', label: 'Cuidado facial noche', icon: 'Nightlight', activo: true, orden: 2 },
    { id: 'bodyCream', label: 'Crema corporal', icon: 'Spa', activo: true, orden: 3 },
  ],
  nutricion: [
    { id: 'cocinar', label: 'Cocinar', icon: 'Restaurant', activo: true, orden: 0 },
    { id: 'agua', label: 'Beber agua', icon: 'WaterDrop', activo: true, orden: 1 },
    { id: 'protein', label: 'Proteína', icon: 'SetMeal', activo: true, orden: 2 },
    { id: 'meds', label: 'Medicamentos', icon: 'Medication', activo: true, orden: 3 },
  ],
  ejercicio: [
    { id: 'meditate', label: 'Meditar', icon: 'SelfImprovement', activo: true, orden: 0 },
    { id: 'stretching', label: 'Correr', icon: 'DirectionsRun', activo: true, orden: 1 },
    { id: 'gym', label: 'Gimnasio', icon: 'FitnessCenter', activo: true, orden: 2 },
    { id: 'cardio', label: 'Bicicleta', icon: 'DirectionsBike', activo: true, orden: 3 },
  ],
  cleaning: [
    { id: 'bed', label: 'Hacer la cama', icon: 'Hotel', activo: true, orden: 0 },
    { id: 'platos', label: 'Lavar platos', icon: 'Dining', activo: true, orden: 1 },
    { id: 'piso', label: 'Limpiar piso', icon: 'CleaningServices', activo: true, orden: 2 },
    { id: 'ropa', label: 'Lavar ropa', icon: 'LocalLaundryService', activo: true, orden: 3 },
  ],
};

export function cloneDefaultCustomHabits() {
  return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_HABITS));
}

export function createEmptyCustomHabits() {
  return {
    bodyCare: [],
    nutricion: [],
    ejercicio: [],
    cleaning: [],
  };
}

/**
 * Inicializa customHabits solo si el usuario nunca los tuvo.
 * @param {boolean} seedDefaults - true: hábitos precargados (usuarios nuevos); false: secciones vacías
 */
export function ensureCustomHabits(user, { seedDefaults = false } = {}) {
  if (!user) return null;
  if (user.customHabits) return user.customHabits;

  user.customHabits = seedDefaults ? cloneDefaultCustomHabits() : createEmptyCustomHabits();
  return user.customHabits;
}

export function applyCustomHabitsToRutinaConfig(customHabits, rutinasConfig, sections, normalizeItemConfig, target) {
  const full = target || {};
  sections.forEach((section) => {
    if (!full[section]) full[section] = {};
    const sectionHabits = customHabits?.[section] || [];
    sectionHabits
      .filter((h) => h?.activo !== false)
      .forEach((habit) => {
        const habitId = habit.id || habit._id;
        if (!habitId) return;
        const globalConfig = rutinasConfig?.[section]?.[habitId];
        full[section][habitId] = normalizeItemConfig(globalConfig || {});
      });
  });
  return full;
}

/**
 * Mapas de completado vacíos (false) alineados a customHabits activos.
 * Evita defaults legacy (bath/agua/gym…) en documentos nuevos.
 */
export function buildEmptyCompletionSections(customHabits, sections = HABIT_SECTION_KEYS) {
  const out = {};
  sections.forEach((section) => {
    out[section] = {};
    const sectionHabits = customHabits?.[section] || [];
    sectionHabits
      .filter((h) => h?.activo !== false)
      .forEach((habit) => {
        const habitId = habit.id || habit._id;
        if (!habitId) return;
        out[section][habitId] = false;
      });
  });
  return out;
}
