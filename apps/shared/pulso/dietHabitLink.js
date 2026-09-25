export const DIET_SLOTS = [
  { id: 'DESAYUNO', label: 'Desayuno' },
  { id: 'ALMUERZO', label: 'Almuerzo' },
  { id: 'MERIENDA', label: 'Merienda' },
  { id: 'CENA', label: 'Cena' },
  { id: 'SNACK', label: 'Snack' },
];

export const DIET_CHANNELS = [
  { id: 'super', label: 'Supermercado' },
  { id: 'verduleria', label: 'Verdulería' },
  { id: 'rotiseria', label: 'Rotisería' },
  { id: 'cocina', label: 'Cocina' },
];

export const SHOP_CHANNELS = DIET_CHANNELS.filter((channel) => channel.id !== 'cocina');

export function defaultDietPlanVinculos() {
  return {
    cocina: DIET_SLOTS.map((slot) => ({
      slot: slot.id,
      section: 'nutricion',
      habitId: 'cocinar',
    })),
    compras: SHOP_CHANNELS.map((channel) => ({
      canal: channel.id,
      section: '',
      habitId: '',
    })),
  };
}

function recetaKey(receta) {
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
export function resolveDietHabitCaptions({ plan, menu, recetas } = {}) {
  const byId = new Map((recetas || []).map((receta) => [recetaKey(receta), receta]));
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
