export const DIET_SLOTS = [
  { id: 'DESAYUNO', label: 'Desayuno' },
  { id: 'ALMUERZO', label: 'Almuerzo' },
  { id: 'MERIENDA', label: 'Merienda' },
  { id: 'CENA', label: 'Cena' },
  { id: 'SNACK', label: 'Snack' },
  { id: 'COMIDA', label: 'Comida' },
];

export const DIET_CHANNELS = [
  { id: 'super', label: 'Supermercado' },
  { id: 'verduleria', label: 'Verdulería' },
  { id: 'rotiseria', label: 'Rotisería' },
  { id: 'farmacia', label: 'Farmacia' },
  { id: 'cocina', label: 'Cocina' },
];

export const SHOP_CHANNELS = DIET_CHANNELS.filter((channel) => channel.id !== 'cocina');

export const DIET_FREQUENCIES = [
  { id: 'DIARIA', label: 'Diaria', dias: 1 },
  { id: 'SEMANAL', label: 'Semanal', dias: 7 },
  { id: 'QUINCENAL', label: 'Quincenal', dias: 14 },
];

export const DIET_UNITS = ['g', 'kg', 'ml', 'l', 'u'];

export const HYDRATION_PERMITS = [
  { id: 'agua', label: 'Agua' },
  { id: 'mate', label: 'Mate' },
  { id: 'cafe', label: 'Café' },
  { id: 'infusion', label: 'Infusiones' },
  { id: 'shake', label: 'Shake proteico' },
];

export const WEEKDAY_LABELS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const MEAL_PRESETS = {
  1: [['13:00', '14:00']],
  2: [['12:00', '13:00'], ['20:00', '21:00']],
  3: [['08:00', '09:00'], ['13:00', '14:00'], ['20:00', '21:00']],
  4: [['08:00', '08:30'], ['12:00', '12:30'], ['16:00', '16:30'], ['20:30', '21:00']],
  5: [['08:00', '08:30'], ['11:00', '11:30'], ['14:00', '14:30'], ['17:00', '17:30'], ['20:30', '21:00']],
  6: [['08:00', '08:20'], ['10:30', '10:50'], ['13:00', '13:30'], ['16:00', '16:20'], ['18:30', '18:50'], ['21:00', '21:30']],
};

const UNIT_ALIASES = new Set(['g', 'kg', 'ml', 'l', 'u', 'un', 'unidad', 'unidades']);

function channelIds() {
  return new Set(DIET_CHANNELS.map((channel) => channel.id));
}

function clampCadencia(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(6, Math.max(1, Math.round(n)));
}

function frequencyId(value) {
  return DIET_FREQUENCIES.some((item) => item.id === value) ? value : 'SEMANAL';
}

export function frequencyDays(frecuencia) {
  return DIET_FREQUENCIES.find((item) => item.id === frequencyId(frecuencia))?.dias || 7;
}

export function frequencyScopeLabel(frecuencia) {
  if (frequencyId(frecuencia) === 'DIARIA') return 'del día';
  if (frequencyId(frecuencia) === 'QUINCENAL') return 'de la quincena';
  return 'de la semana';
}

function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : '';
}

function toMinutes(value) {
  const time = validTime(value);
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(mins) {
  if (mins >= 1440) return '24:00';
  const safe = Math.max(0, mins);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatCantidad(cantidad, unidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return '';
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text} ${unidad || 'u'}`;
}

export function foldName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function parseCalendarDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { y: value.getFullYear(), m: value.getMonth(), d: value.getDate() };
  }
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
  const today = new Date();
  return { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
}

function formatCalendarDate(parts) {
  const month = String(parts.m + 1).padStart(2, '0');
  const day = String(parts.d).padStart(2, '0');
  return `${parts.y}-${month}-${day}`;
}

function addCalendarDays(parts, days) {
  const utc = new Date(Date.UTC(parts.y, parts.m, parts.d + days));
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth(), d: utc.getUTCDate() };
}

export function dietCycleIndex(fecha, frecuencia) {
  const dias = frequencyDays(frecuencia);
  if (dias <= 1) return 0;
  const parts = parseCalendarDate(fecha);
  if (dias === 7) {
    const utc = new Date(Date.UTC(parts.y, parts.m, parts.d));
    return (utc.getUTCDay() + 6) % 7;
  }
  const anchor = Date.UTC(2024, 0, 1);
  const current = Date.UTC(parts.y, parts.m, parts.d);
  const diff = Math.round((current - anchor) / 86400000);
  return ((diff % dias) + dias) % dias;
}

export function cyclePositionLabel(indice, frecuencia) {
  if (frequencyId(frecuencia) === 'DIARIA') return 'Cada día';
  if (frequencyId(frecuencia) === 'SEMANAL') return WEEKDAY_LABELS[indice] || `Día ${indice + 1}`;
  return `Día ${indice + 1}`;
}

export function cycleBounds(fecha, frecuencia) {
  const parts = parseCalendarDate(fecha);
  const indice = dietCycleIndex(parts, frecuencia);
  const dias = frequencyDays(frecuencia);
  const inicio = addCalendarDays(parts, -indice);
  const fin = addCalendarDays(inicio, dias);
  return {
    inicio: formatCalendarDate(inicio),
    fin: formatCalendarDate(fin),
    indice,
    dias,
  };
}

function huecoIds(cadencia) {
  const ids = ['antes'];
  for (let index = 1; index < cadencia; index += 1) ids.push(`entre-${index}`);
  ids.push('despues');
  return ids;
}

function defaultHuecoTipo(id, cadencia) {
  if (cadencia === 1 && id === 'antes') return 'HIDRATACION';
  return 'AYUNO';
}

export function huecoLabel(id, cadencia) {
  if (id === 'antes') return 'Antes de comer';
  if (id === 'despues') return cadencia === 1 ? 'Después de comer' : 'Después de la última comida';
  const match = String(id).match(/^entre-(\d+)$/);
  if (!match) return 'Entre comidas';
  const left = Number(match[1]);
  return `Entre comida ${left} y comida ${left + 1}`;
}

function normalizeComidas(comidas, cadencia) {
  const presets = MEAL_PRESETS[cadencia] || MEAL_PRESETS[1];
  const prev = Array.isArray(comidas) ? comidas : [];
  return presets.map((pair, index) => {
    const existing = prev.find((item) => Number(item?.orden) === index + 1) || prev[index];
    return {
      orden: index + 1,
      inicio: validTime(existing?.inicio) || pair[0],
      fin: validTime(existing?.fin) || pair[1],
    };
  });
}

function normalizeHuecos(huecos, cadencia) {
  const prev = new Map((Array.isArray(huecos) ? huecos : []).map((item) => [item?.id, item?.tipo]));
  return huecoIds(cadencia).map((id) => ({
    id,
    tipo: prev.get(id) === 'HIDRATACION' || prev.get(id) === 'AYUNO'
      ? prev.get(id)
      : defaultHuecoTipo(id, cadencia),
  }));
}

function normalizeRotacion(rotacion, frecuencia) {
  const dias = frequencyDays(frecuencia);
  const prev = new Map((Array.isArray(rotacion) ? rotacion : []).map((row) => [Number(row?.indice), row?.recetas || {}]));
  return Array.from({ length: dias }, (_, indice) => {
    const recetas = {};
    Object.entries(prev.get(indice) || {}).forEach(([orden, recetaId]) => {
      if (recetaId) recetas[String(orden)] = String(recetaId);
    });
    return { indice, recetas };
  });
}

function habitLink(link, extra = {}) {
  return {
    ...extra,
    section: link?.section || '',
    habitId: link?.habitId || '',
  };
}

export function defaultCycleVinculos() {
  return {
    cocina: [{ orden: 0, section: 'nutricion', habitId: 'cocinar' }],
    comida: [{ orden: 0, section: '', habitId: '' }],
    hidratacion: [
      { permite: 'bebida', section: 'nutricion', habitId: 'agua' },
      { permite: 'shake', section: 'nutricion', habitId: 'protein' },
    ],
    compras: DIET_CHANNELS
      .filter((channel) => channel.id !== 'cocina')
      .map((channel) => ({ canal: channel.id, section: '', habitId: '' })),
  };
}

function normalizeVinculos(vinculos) {
  const base = defaultCycleVinculos();
  if (!vinculos || typeof vinculos !== 'object') return base;

  if (Array.isArray(vinculos.cocina) && vinculos.cocina.length) {
    const modern = vinculos.cocina.some((link) => link?.orden != null && link?.slot == null);
    if (modern) {
      base.cocina = vinculos.cocina.map((link) => habitLink(link, { orden: Number(link?.orden) || 0 }));
    } else {
      const first = vinculos.cocina.find((link) => link?.habitId) || vinculos.cocina[0];
      base.cocina = [habitLink(first, { orden: 0 })];
    }
  }

  if (Array.isArray(vinculos.comida) && vinculos.comida.length) {
    base.comida = vinculos.comida.map((link) => habitLink(link, { orden: Number(link?.orden) || 0 }));
  }

  if (Array.isArray(vinculos.hidratacion) && vinculos.hidratacion.length) {
    base.hidratacion = vinculos.hidratacion.map((link) => habitLink(link, {
      permite: link?.permite === 'shake' ? 'shake' : 'bebida',
    }));
  }

  if (Array.isArray(vinculos.compras) && vinculos.compras.length) {
    const byCanal = new Map(vinculos.compras.map((link) => [link?.canal, link]));
    base.compras = base.compras.map((link) => habitLink(byCanal.get(link.canal) || link, { canal: link.canal }));
    vinculos.compras.forEach((link) => {
      if (link?.canal && !base.compras.some((item) => item.canal === link.canal)) {
        base.compras.push(habitLink(link, { canal: link.canal }));
      }
    });
  }

  return base;
}

export function normalizeDietPlan(plan = {}) {
  const cadencia = clampCadencia(plan?.cadencia ?? 1);
  const frecuencia = frequencyId(plan?.frecuencia);
  return {
    cadencia,
    frecuencia,
    calorias: nonNegative(plan?.calorias),
    proteinas: nonNegative(plan?.proteinas),
    carbohidratos: nonNegative(plan?.carbohidratos),
    grasas: nonNegative(plan?.grasas),
    comidas: normalizeComidas(plan?.comidas, cadencia),
    huecos: normalizeHuecos(plan?.huecos, cadencia),
    rotacion: normalizeRotacion(plan?.rotacion, frecuencia),
    vinculos: normalizeVinculos(plan?.vinculos),
  };
}

export function planHasRotation(plan) {
  return (plan?.rotacion || []).some((row) => Object.values(row?.recetas || {}).some(Boolean));
}

export function recetaKey(receta) {
  return String(receta?.id || receta?._id || '');
}

function indexRecetas(recetas) {
  return new Map((recetas || []).map((receta) => [recetaKey(receta), receta]));
}

export function resolveDietDay({ plan, recetas, fecha } = {}) {
  const normalized = normalizeDietPlan(plan);
  const indice = dietCycleIndex(fecha, normalized.frecuencia);
  const row = normalized.rotacion.find((item) => item.indice === indice);
  const byId = indexRecetas(recetas);
  const comidas = normalized.comidas.map((comida) => {
    const id = String(row?.recetas?.[String(comida.orden)] || '');
    return {
      orden: comida.orden,
      inicio: comida.inicio,
      fin: comida.fin,
      recetaId: id,
      receta: byId.get(id) || null,
    };
  });
  return {
    indice,
    etiqueta: cyclePositionLabel(indice, normalized.frecuencia),
    comidas,
  };
}

export function buildDietTimeline(plan) {
  const normalized = normalizeDietPlan(plan);
  const meals = [...normalized.comidas].sort((a, b) => a.orden - b.orden);
  const huecoTipo = new Map(normalized.huecos.map((item) => [item.id, item.tipo]));
  const periodos = [];

  const pushGap = (id, start, end) => {
    if (end <= start) return;
    const tipo = huecoTipo.get(id) === 'HIDRATACION' ? 'HIDRATACION' : 'AYUNO';
    periodos.push({
      id,
      tipo,
      inicio: formatMinutes(start),
      fin: formatMinutes(end),
      orden: null,
    });
  };

  if (!meals.length) {
    pushGap('antes', 0, 1440);
    return periodos;
  }

  pushGap('antes', 0, toMinutes(meals[0].inicio));
  meals.forEach((meal, index) => {
    const start = toMinutes(meal.inicio);
    const end = Math.max(start + 1, toMinutes(meal.fin));
    periodos.push({
      id: `comida-${meal.orden}`,
      tipo: 'COMIDA',
      inicio: formatMinutes(start),
      fin: formatMinutes(end >= 1440 ? 1439 : end),
      orden: meal.orden,
    });
    const next = meals[index + 1];
    if (next) pushGap(`entre-${index + 1}`, end, toMinutes(next.inicio));
    else pushGap('despues', end, 1440);
  });
  return periodos;
}

function cycleOccurrences(plan, recetas) {
  const normalized = normalizeDietPlan(plan);
  const byId = indexRecetas(recetas);
  const occurrences = [];
  normalized.rotacion.forEach((row) => {
    normalized.comidas.forEach((comida) => {
      const receta = byId.get(String(row.recetas?.[String(comida.orden)] || ''));
      if (receta) occurrences.push({ indice: row.indice, orden: comida.orden, receta });
    });
  });
  return occurrences;
}

export function sumMacros(occurrences) {
  return (occurrences || []).reduce((acc, { receta }) => {
    acc.calorias += Number(receta?.calorias) || 0;
    acc.proteinas += Number(receta?.proteinas) || 0;
    acc.carbohidratos += Number(receta?.carbohidratos) || 0;
    acc.grasas += Number(receta?.grasas) || 0;
    acc.comidas += 1;
    return acc;
  }, {
    calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, comidas: 0,
  });
}

export function sumIngredients(occurrences) {
  const map = new Map();
  (occurrences || []).forEach(({ receta }) => {
    (receta?.ingredientes || []).forEach((ing) => {
      if (!ing?.nombre) return;
      const unidad = String(ing.unidad || 'u').toLowerCase();
      const canal = channelIds().has(ing.canal) ? ing.canal : 'super';
      const key = `${foldName(ing.nombre)}|${unidad}|${canal}`;
      const cantidad = ing.cantidad == null || ing.cantidad === '' ? 1 : nonNegative(ing.cantidad);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { nombre: ing.nombre, unidad, canal, cantidad });
      } else {
        prev.cantidad += cantidad;
      }
    });
  });
  return [...map.values()];
}

export function aggregateDietCycle({ plan, recetas } = {}) {
  const occurrences = cycleOccurrences(plan, recetas);
  return {
    macros: sumMacros(occurrences),
    ingredientes: sumIngredients(occurrences),
  };
}

export const MEAL_FRANJAS = [
  { id: 'MAÑANA', label: 'Mañana', inicio: '08:00', fin: '12:00' },
  { id: 'TARDE', label: 'Tarde', inicio: '12:00', fin: '18:00' },
  { id: 'NOCHE', label: 'Noche', inicio: '18:00', fin: '22:00' },
];

const MEAL_FRANJA_IDS = new Set(MEAL_FRANJAS.map((franja) => franja.id));

export function dietIndexToWeekday(index) {
  return index === 6 ? 0 : index + 1;
}

export function mealsUseSchedule(recetas) {
  return (recetas || []).some((receta) => receta?.frecuencia);
}

export function mealPlacements(recetas, mondayIndex) {
  const weekday = dietIndexToWeekday(mondayIndex);
  const placed = [];
  (recetas || []).forEach((receta) => {
    if (!receta?.frecuencia) return;
    const dias = Array.isArray(receta.dias) ? receta.dias.map(Number) : [];
    const active = receta.frecuencia === 'DIARIA' || dias.includes(weekday);
    if (!active) return;
    const franjas = (Array.isArray(receta.franjas) ? receta.franjas : []).filter((id) => MEAL_FRANJA_IDS.has(id));
    franjas.forEach((franja) => placed.push({ receta, franja }));
  });
  return placed;
}

export function aggregateMeals(recetas) {
  const occurrences = [];
  for (let index = 0; index < 7; index += 1) {
    mealPlacements(recetas, index).forEach(({ receta }) => {
      occurrences.push({ receta });
    });
  }
  return {
    macros: sumMacros(occurrences),
    ingredientes: sumIngredients(occurrences),
  };
}

export function scheduleToPlan(recetas, vinculos) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((index) => mealPlacements(recetas, index));
  const cadencia = Math.max(1, ...days.map((day) => day.length));
  const comidas = Array.from({ length: cadencia }, (_, index) => {
    const sample = days.find((day) => day[index])?.[index];
    const franja = MEAL_FRANJAS.find((item) => item.id === sample?.franja) || MEAL_FRANJAS[1];
    return { orden: index + 1, inicio: franja.inicio, fin: franja.fin };
  });
  const rotacion = days.map((placed, indice) => ({
    indice,
    recetas: Object.fromEntries(
      placed.map((item, index) => [String(index + 1), recetaKey(item.receta)]),
    ),
  }));
  return normalizeDietPlan({
    cadencia,
    frecuencia: 'SEMANAL',
    comidas,
    rotacion,
    vinculos,
  });
}

export function dayOccurrences(day) {
  return (day?.comidas || [])
    .filter((meal) => meal?.receta)
    .map((meal) => ({ indice: day.indice, orden: meal.orden, receta: meal.receta }));
}

function namesMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 3) return false;
  const escaped = shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(longer);
}

export function matchDespensa(ingredientes, { inventario = [], transacciones = [] } = {}) {
  return (ingredientes || []).map((ing) => {
    const needle = foldName(ing.nombre);
    const stocks = needle
      ? inventario.filter((item) => namesMatch(foldName(item?.nombre), needle))
      : [];
    const buys = needle
      ? transacciones.filter((tx) => {
        if (!namesMatch(foldName(tx?.descripcion), needle)) return false;
        if (ing.canal === 'farmacia') {
          return tx.categoria === 'Salud y Belleza' || tx.categoria === 'Comida y Mercado' || !tx.categoria;
        }
        return !tx.categoria || tx.categoria === 'Comida y Mercado';
      })
      : [];
    return {
      ...ing,
      enDespensa: stocks.length > 0,
      comprado: buys.length > 0,
      despensa: stocks.map((item) => item.nombre).filter(Boolean),
    };
  });
}

export function parseIngredientes(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((part) => part.trim()).filter(Boolean);
      const channels = channelIds();
      let canal = 'super';
      if (channels.has(parts[parts.length - 1])) canal = parts.pop();
      const nombre = parts.shift() || '';
      let cantidad = 1;
      let unidad = 'u';
      if (parts.length && /^\d+([.]\d+)?$/.test(parts[0].replace(',', '.'))) {
        cantidad = Number(parts.shift().replace(',', '.'));
      }
      if (parts.length) {
        unidad = parts[0].toLowerCase();
        if (!UNIT_ALIASES.has(unidad)) unidad = 'u';
        if (unidad === 'un' || unidad === 'unidad' || unidad === 'unidades') unidad = 'u';
      }
      return { nombre, cantidad, unidad, canal };
    })
    .filter((item) => item.nombre);
}

export function formatIngredientes(list) {
  return (list || [])
    .map((item) => {
      const cantidad = item.cantidad == null ? 1 : item.cantidad;
      const unidad = item.unidad || 'u';
      return `${item.nombre}, ${cantidad}, ${unidad}, ${item.canal || 'super'}`;
    })
    .join('\n');
}

function habitIdOf(habit) {
  if (!habit) return '';
  if (habit.id != null && String(habit.id).length > 0) return String(habit.id);
  if (habit._id != null) return String(habit._id);
  return '';
}

export function listHabits(habits) {
  const rows = [];
  Object.entries(habits || {}).forEach(([section, list]) => {
    const items = Array.isArray(list)
      ? list
      : (list && typeof list === 'object'
        ? Object.values(list).filter((item) => item && typeof item === 'object' && (item.id || item.label))
        : []);
    items.forEach((habit) => {
      if (!habit || habit.activo === false) return;
      const habitId = habitIdOf(habit);
      if (!habitId) return;
      rows.push({ section, habit, habitId });
    });
  });
  return rows;
}

export function inferDietRole(habit, section) {
  const id = foldName(habit?.id);
  const label = foldName(habit?.label || habit?.name);
  const text = `${id} ${label}`;
  const compra = /compra|super|mercado|verdul|farmacia|rotiser/.test(text);
  if (compra || (section !== 'nutricion' && /fruta/.test(text))) {
    return { role: 'compra', canal: inferCanal(text) };
  }
  const looksNutrition = section === 'nutricion' || /comida|nutri|aliment|cocin|agua|shake|prote|mate|cafe|ayuno|infusion/.test(text);
  if (!looksNutrition) return null;
  if (/cocin/.test(text) || id === 'cocinar') return { role: 'cocina' };
  if (/shake/.test(text) || id === 'protein' || /proteina|prote/.test(text)) return { role: 'hidratacion', permite: 'shake' };
  if (/agua|mate|cafe|infusion|hidrat/.test(text) || id === 'agua') return { role: 'hidratacion', permite: 'bebida' };
  if (/comer|comida|almuerz|cena|desayun/.test(text)) return { role: 'comida' };
  return null;
}

function inferCanal(text) {
  if (/verdul|fruta/.test(text)) return 'verduleria';
  if (/farmacia|vitamin|medic/.test(text)) return 'farmacia';
  if (/rotiser/.test(text)) return 'rotiseria';
  if (/cocina/.test(text) && /compra/.test(text)) return 'cocina';
  return 'super';
}

function habitTipo(habitConfig, section, habitId) {
  return String(habitConfig?.[section]?.[habitId]?.tipo || 'DIARIO').toUpperCase();
}

function scopeForHabit(habitConfig, section, habitId) {
  const tipo = habitTipo(habitConfig, section, habitId);
  if (tipo === 'SEMANAL' || tipo === 'MENSUAL' || tipo === 'QUINCENAL') return 'CICLO';
  return 'DIA';
}

function addCaption(captions, section, habitId, text) {
  if (!section || !habitId || !text) return;
  if (!captions[section]) captions[section] = {};
  const prev = captions[section][habitId];
  captions[section][habitId] = prev ? `${prev} · ${text}` : text;
}

function uniqueNames(occurrences) {
  const names = [];
  (occurrences || []).forEach(({ receta }) => {
    if (receta?.nombre && !names.includes(receta.nombre)) names.push(receta.nombre);
  });
  return names;
}

function clip(text) {
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}…`;
}

function ingredientCaption(list) {
  const parts = (list || []).map((ing) => {
    const qty = formatCantidad(ing.cantidad, ing.unidad);
    const label = qty ? `${ing.nombre} ${qty}` : ing.nombre;
    return ing.enDespensa || ing.comprado ? label : `reponer ${label}`;
  });
  return clip(parts.join(' · '));
}

function hydrationCaption(timeline, permite) {
  const windows = (timeline || []).filter((period) => period.tipo === 'HIDRATACION');
  if (!windows.length) return '';
  const hours = windows.map((period) => `${period.inicio}–${period.fin}`).join(', ');
  if (permite === 'shake') return `${hours} · shake proteico`;
  return `${hours} · agua, mate, café, infusiones`;
}

function mealCaption(meals) {
  const parts = (meals || []).filter((meal) => meal.receta?.nombre).map((meal) => (
    `${meal.inicio}–${meal.fin} ${meal.receta.nombre}`
  ));
  return clip(parts.join(' · '));
}

function mealsForOrden(day, orden) {
  if (!orden) return day?.comidas || [];
  return (day?.comidas || []).filter((meal) => meal.orden === orden);
}

export function resolveCycleDietHabitCaptions({
  plan,
  recetas,
  fecha,
  habits,
  habitConfig,
  ingredientes,
} = {}) {
  const normalized = normalizeDietPlan(plan);
  const day = resolveDietDay({ plan: normalized, recetas, fecha });
  const cycle = aggregateDietCycle({ plan: normalized, recetas });
  const timeline = buildDietTimeline(normalized);
  const stocked = Array.isArray(ingredientes) ? ingredientes : cycle.ingredientes;
  const captions = {};
  const claimed = new Set();

  const claim = (section, habitId) => {
    if (!section || !habitId) return false;
    const key = `${section}:${habitId}`;
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  };

  (normalized.vinculos?.cocina || []).forEach((link) => {
    if (!claim(link.section, link.habitId)) return;
    const scope = scopeForHabit(habitConfig, link.section, link.habitId);
    const names = scope === 'CICLO'
      ? uniqueNames(cycleOccurrences(normalized, recetas))
      : uniqueNames(dayOccurrences({ ...day, comidas: mealsForOrden(day, link.orden) }));
    const text = scope === 'DIA' && names.length ? `${day.etiqueta} · ${names.join(', ')}` : names.join(', ');
    addCaption(captions, link.section, link.habitId, text);
  });

  (normalized.vinculos?.comida || []).forEach((link) => {
    if (!claim(link.section, link.habitId)) return;
    addCaption(captions, link.section, link.habitId, mealCaption(mealsForOrden(day, link.orden)));
  });

  (normalized.vinculos?.hidratacion || []).forEach((link) => {
    if (!claim(link.section, link.habitId)) return;
    addCaption(captions, link.section, link.habitId, hydrationCaption(timeline, link.permite));
  });

  (normalized.vinculos?.compras || []).forEach((link) => {
    if (!claim(link.section, link.habitId)) return;
    const scope = scopeForHabit(habitConfig, link.section, link.habitId);
    const source = scope === 'CICLO'
      ? stocked
      : matchForward(day, link.canal, stocked);
    addCaption(
      captions,
      link.section,
      link.habitId,
      ingredientCaption(source.filter((ing) => ing.canal === link.canal && ing.canal !== 'cocina')),
    );
  });

  listHabits(habits).forEach(({ section, habit, habitId }) => {
    if (!claim(section, habitId)) return;
    const role = inferDietRole(habit, section);
    if (!role) return;
    if (role.role === 'cocina') {
      const scope = scopeForHabit(habitConfig, section, habitId);
      const names = scope === 'CICLO'
        ? uniqueNames(cycleOccurrences(normalized, recetas))
        : uniqueNames(dayOccurrences(day));
      const text = scope === 'DIA' && names.length ? `${day.etiqueta} · ${names.join(', ')}` : names.join(', ');
      addCaption(captions, section, habitId, text);
    } else if (role.role === 'comida') {
      addCaption(captions, section, habitId, mealCaption(day.comidas));
    } else if (role.role === 'hidratacion') {
      addCaption(captions, section, habitId, hydrationCaption(timeline, role.permite));
    } else if (role.role === 'compra') {
      const scope = scopeForHabit(habitConfig, section, habitId);
      const source = scope === 'CICLO' ? stocked : matchForward(day, role.canal, stocked);
      addCaption(
        captions,
        section,
        habitId,
        ingredientCaption(source.filter((ing) => ing.canal === role.canal && ing.canal !== 'cocina')),
      );
    }
  });

  return captions;
}

function matchForward(day, canal, stocked) {
  const fresh = sumIngredients(dayOccurrences(day)).filter((ing) => ing.canal === canal);
  const flags = new Map((stocked || []).map((ing) => [`${foldName(ing.nombre)}|${ing.unidad}|${ing.canal}`, ing]));
  return fresh.map((ing) => {
    const prev = flags.get(`${foldName(ing.nombre)}|${ing.unidad}|${ing.canal}`);
    return prev ? { ...ing, enDespensa: prev.enDespensa, comprado: prev.comprado } : ing;
  });
}
