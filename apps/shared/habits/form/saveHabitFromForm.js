import { normalizeHabitConfig } from './habitFormDefaults.js';

export function generateHabitId(label) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 30);
}

/**
 * Crea hábito + preferencias de cadencia (misma lógica que HabitFormDialog).
 */
export async function saveHabitFromForm({
  label,
  section,
  icon = 'Add',
  config,
  habits,
  addHabit,
  updateUserHabitPreference,
  fetchHabits,
}) {
  const trimmed = (label || '').trim();
  if (!trimmed) {
    throw new Error('Nombre de hábito requerido');
  }

  const baseId = generateHabitId(trimmed);
  if (!baseId) {
    throw new Error('Nombre de hábito no válido');
  }

  let habitId = baseId;
  let counter = 1;
  while (habits[section]?.some((h) => h.id === habitId)) {
    habitId = `${baseId}${counter}`;
    counter += 1;
  }

  const orden = habits[section]?.length || 0;
  await addHabit(section, {
    id: habitId,
    label: trimmed,
    icon: icon || 'Add',
    activo: true,
    orden,
  });

  const normalizedConfig = normalizeHabitConfig(config);
  if (updateUserHabitPreference) {
    await updateUserHabitPreference(section, habitId, normalizedConfig, true);
  }

  if (fetchHabits) {
    await fetchHabits();
  }

  return habitId;
}
