import { HABIT_SECTIONS } from '@attadia/shared/habits';

const BUILTIN_HABIT_SECTIONS = [...HABIT_SECTIONS];

const RUTINA_DOC_META_KEYS = new Set([
  '_id',
  'id',
  '__v',
  'fecha',
  'config',
  'completitud',
  'completitudPorSeccion',
  'usuario',
  'metadata',
  'orden',
  'createdAt',
  'updatedAt',
  'nombre',
  'notas',
  'tipo',
  'historial',
  'completacionesSemana',
  '_expandedSections',
]);

export function getCustomHabitSections(user) {
  const sections = user?.preferences?.customHabitSections;
  return Array.isArray(sections) ? sections : [];
}

export function getValidHabitSections(user) {
  const customIds = getCustomHabitSections(user)
    .map((section) => section?.id)
    .filter(Boolean);
  return [
    ...BUILTIN_HABIT_SECTIONS,
    ...customIds.filter((id) => !BUILTIN_HABIT_SECTIONS.includes(id)),
  ];
}

export function isValidHabitSection(user, section) {
  return Boolean(section) && getValidHabitSections(user).includes(section);
}

/** Secciones de una rutina: built-in + claves dinámicas en config y en el documento. */
export function collectRutinaSectionKeys(rutinaDoc = {}) {
  const keys = new Set(BUILTIN_HABIT_SECTIONS);

  const config = rutinaDoc?.config;
  if (config && typeof config === 'object') {
    Object.keys(config).forEach((key) => {
      if (key !== '_metadata') keys.add(key);
    });
  }

  Object.keys(rutinaDoc || {}).forEach((key) => {
    if (RUTINA_DOC_META_KEYS.has(key)) return;
    const value = rutinaDoc[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.add(key);
    }
  });

  return [...keys];
}

export function markCustomHabitsSectionModified(user, section) {
  user.markModified('customHabits');
  if (section) {
    user.markModified(`customHabits.${section}`);
  }
}
