/** ID helpers and section metadata — safe for Node/backend (no React/MUI imports). */

export const HABIT_SECTIONS = ['bodyCare', 'nutricion', 'ejercicio', 'cleaning'];

/** Legacy item IDs per section (keys from iconConfig, without MUI components). */
export const LEGACY_HABIT_SECTION_ITEM_IDS = {
  bodyCare: ['bath', 'skinCareDay', 'skinCareNight', 'bodyCream'],
  nutricion: ['cocinar', 'agua', 'protein', 'meds'],
  ejercicio: ['meditate', 'stretching', 'gym', 'cardio'],
  cleaning: ['bed', 'platos', 'piso', 'ropa'],
};

export const DEFAULT_HABIT_ITEM_CONFIG = {
  tipo: 'DIARIO',
  frecuencia: 1,
  activo: true,
  periodo: 'CADA_DIA',
};

/** ID estable para API y rutina (prioriza `id` sobre `_id` de subdocumento). */
export function getHabitId(habit) {
  if (!habit) return null;
  if (habit.id != null && String(habit.id).length > 0) return String(habit.id);
  if (habit._id != null) return String(habit._id);
  return null;
}

/** Compara un hábito con un id recibido (soporta `id` o `_id`). */
export function habitIdsMatch(habit, habitId) {
  if (!habit || habitId == null) return false;
  const needle = String(habitId);
  if (habit.id != null && String(habit.id) === needle) return true;
  if (habit._id != null && String(habit._id) === needle) return true;
  return false;
}

export function findHabitIndexInSection(sectionHabits, habitId) {
  if (!Array.isArray(sectionHabits)) return -1;
  return sectionHabits.findIndex((h) => habitIdsMatch(h, habitId));
}

export function hasCustomHabitsStructure(habits) {
  return habits && HABIT_SECTIONS.some((section) => Array.isArray(habits[section]));
}

/** Secciones base + claves dinámicas presentes en customHabits. */
export function getHabitSectionKeys(habits = null) {
  const keys = [...HABIT_SECTIONS];
  if (!habits || typeof habits !== 'object') return keys;

  Object.keys(habits).forEach((key) => {
    if (!HABIT_SECTIONS.includes(key) && Array.isArray(habits[key])) {
      keys.push(key);
    }
  });

  return keys;
}

/** Hábito personalizado del usuario (para acciones de edición). */
export function findUserHabit(section, itemId, habits = null) {
  if (!section || !itemId || !habits) return null;
  const sectionHabits = Array.isArray(habits[section]) ? habits[section] : [];
  return sectionHabits.find((h) => habitIdsMatch(h, itemId)) || null;
}

/**
 * IDs de hábitos a mostrar en una sección (customHabits del usuario o legacy item IDs).
 */
export function getHabitSectionItemIds(section, habits = null) {
  if (hasCustomHabitsStructure(habits)) {
    return (habits[section] || [])
      .filter((h) => h?.activo !== false)
      .sort((a, b) => (a?.orden || 0) - (b?.orden || 0))
      .map((h) => getHabitId(h))
      .filter(Boolean);
  }
  return LEGACY_HABIT_SECTION_ITEM_IDS[section] || [];
}

/**
 * IDs con icono resoluble para el carrusel (alineado con RutinaCard colapsado).
 * Node-safe — no depende de iconConfig/MUI.
 */
export function getCarouselSectionItemIds(section, iconsMap = {}, habits = null) {
  const sectionIcons = iconsMap?.[section] || {};

  if (hasCustomHabitsStructure(habits)) {
    return (habits[section] || [])
      .filter((h) => h?.activo !== false)
      .sort((a, b) => (a?.orden || 0) - (b?.orden || 0))
      .map((h) => getHabitId(h))
      .filter((itemId) => itemId && sectionIcons[itemId]);
  }

  return Object.keys(sectionIcons);
}
