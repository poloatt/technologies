/**
 * UI-only habit icons (browser/MUI). Requires iconConfig — not part of @shared/habits domain.
 *
 * - buildHabitSectionIconsMap: MUI icon components per section/item
 * - resolveHabitIcon: single icon lookup for custom habits
 *
 * Node-safe ID/label helpers are re-exported from @shared/habits/domain for convenience.
 */
import { iconConfig, getIconByName } from './iconConfig.js';
import { buildHabitSectionLabelsMap } from '../habits/domain/buildHabitSectionLabelsMap.js';
import {
  HABIT_SECTIONS,
  hasCustomHabitsStructure,
  getHabitId,
  getHabitSectionKeys,
} from '../habits/domain/habitSectionIds.js';

export { resolveRutinaForDate } from '../habits/domain/resolveRutinaForDate.js';
export { buildHabitSectionLabelsMap } from '../habits/domain/buildHabitSectionLabelsMap.js';

export {
  findHabitIndexInSection,
  getHabitId,
  habitIdsMatch,
  HABIT_SECTIONS,
  getHabitSectionKeys,
  hasCustomHabitsStructure,
  getHabitSectionItemIds,
  getCarouselSectionItemIds,
  findUserHabit,
  DEFAULT_HABIT_ITEM_CONFIG,
} from '../habits/domain/habitSectionIds.js';

export { getHabitDisplayLabel } from '../habits/domain/habitDisplayLabels.js';

/**
 * Mapa de iconos MUI + labels por sección (browser/UI only — requiere iconConfig).
 */
export function buildHabitSectionIconsMap(habits = {}) {
  const { labelsMap } = buildHabitSectionLabelsMap(habits);
  const iconsMap = {};
  const useCustomOnly = hasCustomHabitsStructure(habits);

  getHabitSectionKeys(habits).forEach((section) => {
    iconsMap[section] = {};

    if (!useCustomOnly) {
      const legacy = iconConfig?.[section] || {};
      Object.entries(legacy).forEach(([itemId, Icon]) => {
        if (!labelsMap[section]?.[itemId]) return;
        iconsMap[section][itemId] = Icon;
      });
    }

    const sectionHabits = Array.isArray(habits?.[section]) ? habits[section] : [];
    sectionHabits
      .filter((h) => h?.activo !== false)
      .sort((a, b) => (a?.orden || 0) - (b?.orden || 0))
      .forEach((habit) => {
        const itemId = getHabitId(habit);
        if (!itemId) return;
        const Icon = getIconByName(habit.icon);
        if (!Icon) return;
        iconsMap[section][itemId] = Icon;
      });
  });

  return { iconsMap, labelsMap };
}

/**
 * Resuelve icono MUI para un hábito personalizado.
 * UI-only (requiere iconConfig/MUI); permanece en @shared/utils, no en @shared/habits.
 */
export function resolveHabitIcon(habits, section, itemId) {
  const { iconsMap } = buildHabitSectionIconsMap(habits);
  const Icon = iconsMap[section]?.[itemId];
  if (Icon) return Icon;

  const habit = (habits?.[section] || []).find(
    (h) => (h.id || h._id) === itemId,
  );
  return habit?.icon ? getIconByName(habit.icon) : null;
}
