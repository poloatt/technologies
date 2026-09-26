import {
  DIET_CHANNELS,
  DIET_FREQUENCIES,
  DIET_SLOTS,
  DIET_UNITS,
  HYDRATION_PERMITS,
  SHOP_CHANNELS,
  WEEKDAY_LABELS,
  aggregateDietCycle,
  buildDietTimeline,
  cycleBounds,
  cyclePositionLabel,
  dayOccurrences,
  defaultCycleVinculos,
  dietCycleIndex,
  foldName,
  formatCantidad,
  formatIngredientes,
  frequencyDays,
  frequencyScopeLabel,
  huecoLabel,
  inferDietRole,
  listHabits,
  matchDespensa,
  mealPlacements,
  mealsUseSchedule,
  MEAL_FRANJAS,
  aggregateMeals,
  scheduleToPlan,
  normalizeDietPlan,
  parseCalendarDate,
  parseIngredientes,
  planHasRotation,
  recetaKey,
  resolveCycleDietHabitCaptions,
  resolveDietDay,
  sumIngredients,
  sumMacros,
} from './dietCycle.js';

export {
  DIET_CHANNELS,
  DIET_FREQUENCIES,
  DIET_SLOTS,
  DIET_UNITS,
  HYDRATION_PERMITS,
  SHOP_CHANNELS,
  WEEKDAY_LABELS,
  aggregateDietCycle,
  buildDietTimeline,
  cycleBounds,
  cyclePositionLabel,
  dayOccurrences,
  dietCycleIndex,
  foldName,
  formatCantidad,
  formatIngredientes,
  frequencyDays,
  frequencyScopeLabel,
  huecoLabel,
  inferDietRole,
  listHabits,
  matchDespensa,
  mealPlacements,
  mealsUseSchedule,
  MEAL_FRANJAS,
  aggregateMeals,
  scheduleToPlan,
  normalizeDietPlan,
  parseCalendarDate,
  parseIngredientes,
  planHasRotation,
  recetaKey,
  resolveDietDay,
  sumIngredients,
  sumMacros,
};

export function defaultDietPlanVinculos() {
  return defaultCycleVinculos();
}

function menuRecetaKey(receta) {
  return String(receta?.id || receta?._id || '');
}

function addCaption(captions, section, habitId, text) {
  if (!section || !habitId || !text) return;
  if (!captions[section]) captions[section] = {};
  const prev = captions[section][habitId];
  captions[section][habitId] = prev ? `${prev} · ${text}` : text;
}

/**
 * Texto del menú del día para cada hábito vinculado.
 * No lee ni escribe la completitud de la rutina.
 */
function resolveMenuDietHabitCaptions({ plan, menu, recetas } = {}) {
  const byId = new Map((recetas || []).map((receta) => [menuRecetaKey(receta), receta]));
  const slots = menu?.slots || {};
  const captions = {};

  const assigned = DIET_SLOTS.map((slot) => {
    const entry = slots[slot.id] || {};
    const receta = byId.get(String(entry.recetaId || ''));
    return receta ? { slot: slot.id, receta } : null;
  }).filter(Boolean);

  (plan?.vinculos?.cocina || []).forEach((link) => {
    const row = assigned.find((item) => item.slot === link.slot);
    if (row?.receta?.nombre) addCaption(captions, link.section, link.habitId, row.receta.nombre);
  });

  (plan?.vinculos?.compras || []).forEach((link) => {
    if (!link.habitId || !link.canal) return;
    const names = [];
    assigned.forEach(({ receta }) => {
      (receta.ingredientes || []).forEach((ing) => {
        if (ing?.canal === link.canal && ing.nombre) names.push(ing.nombre);
      });
    });
    if (names.length) addCaption(captions, link.section, link.habitId, names.join(', '));
  });

  return captions;
}

export function resolveDietHabitCaptions(input = {}) {
  if (planHasRotation(input.plan)) return resolveCycleDietHabitCaptions(input);
  return resolveMenuDietHabitCaptions(input);
}
