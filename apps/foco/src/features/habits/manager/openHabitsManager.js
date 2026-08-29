export const OPEN_HABITS_MANAGER_EVENT = 'openHabitsManager';

/** @deprecated Use OPEN_HABITS_MANAGER_EVENT */
export const LEGACY_OPEN_HABIT_TEMPLATES_EVENT = 'openHabitTemplates';

export function dispatchOpenHabitsManager() {
  window.dispatchEvent(new CustomEvent(OPEN_HABITS_MANAGER_EVENT));
}

export function listenOpenHabitsManager(handler) {
  window.addEventListener(OPEN_HABITS_MANAGER_EVENT, handler);
  window.addEventListener(LEGACY_OPEN_HABIT_TEMPLATES_EVENT, handler);
  return () => {
    window.removeEventListener(OPEN_HABITS_MANAGER_EVENT, handler);
    window.removeEventListener(LEGACY_OPEN_HABIT_TEMPLATES_EVENT, handler);
  };
}
