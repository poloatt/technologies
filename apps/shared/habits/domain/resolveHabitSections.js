import { HABIT_SECTIONS } from './habitSectionIds.js';
import { RUTINA_SECTION_LABELS } from '../desktop/rutinaDesktopUtils.js';

/**
 * Combina secciones base con grupos personalizados del usuario.
 */
export function resolveHabitSections(customSections = []) {
  const customIds = (customSections || [])
    .map((section) => section?.id)
    .filter((id) => id && !HABIT_SECTIONS.includes(id));
  return [...HABIT_SECTIONS, ...customIds];
}

export function resolveSectionLabel(section, customSections = []) {
  if (RUTINA_SECTION_LABELS[section]) return RUTINA_SECTION_LABELS[section];
  const custom = (customSections || []).find((entry) => entry?.id === section);
  return custom?.label || section;
}

export function resolveSectionIconKey(section, customSections = []) {
  const custom = (customSections || []).find((entry) => entry?.id === section);
  return custom?.icon || null;
}

/** Grupo creado por el usuario (no es bodyCare, nutricion, etc.). */
export function isCustomHabitSection(section) {
  return Boolean(section) && !HABIT_SECTIONS.includes(section);
}
