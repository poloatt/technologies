import { getHabitDisplayLabel } from './habitDisplayLabels.js';
import {
  HABIT_SECTIONS,
  hasCustomHabitsStructure,
  getHabitId,
  getHabitSectionKeys,
  LEGACY_HABIT_SECTION_ITEM_IDS,
} from './habitSectionIds.js';

/**
 * Mapa de labels por sección (Node-safe, sin MUI/iconConfig).
 */
export function buildHabitSectionLabelsMap(habits = {}) {
  const labelsMap = {};
  const useCustomOnly = hasCustomHabitsStructure(habits);

  getHabitSectionKeys(habits).forEach((section) => {
    labelsMap[section] = {};

    if (!useCustomOnly) {
      const legacyIds = LEGACY_HABIT_SECTION_ITEM_IDS[section] || [];
      legacyIds.forEach((itemId) => {
        labelsMap[section][itemId] = getHabitDisplayLabel(section, itemId, habits);
      });
    }

    const sectionHabits = Array.isArray(habits?.[section]) ? habits[section] : [];
    sectionHabits
      .filter((h) => h?.activo !== false)
      .sort((a, b) => (a?.orden || 0) - (b?.orden || 0))
      .forEach((habit) => {
        const itemId = getHabitId(habit);
        if (!itemId) return;
        labelsMap[section][itemId] = getHabitDisplayLabel(section, itemId, habits);
      });
  });

  return { labelsMap };
}
