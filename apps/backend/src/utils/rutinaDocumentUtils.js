import { DEFAULT_HABIT_ITEM_CONFIG } from '@attadia/shared/habits';

/** Convierte subdocumentos Mongoose o valores anidados a objetos planos. */
export function toPlainValue(value) {
  if (value == null) return value;
  if (typeof value.toObject === 'function') {
    return value.toObject({ flattenMaps: true, depopulate: true });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toPlainValue(entry));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toPlainValue(entry)]),
    );
  }
  return value;
}

/** Config mínima de un ítem de rutina, fusionando con lo existente en el documento. */
export function repairRutinaItemConfig(value) {
  const plain = toPlainValue(value);
  if (plain && typeof plain === 'object' && !Array.isArray(plain)) {
    return plain;
  }

  return {
    ...DEFAULT_HABIT_ITEM_CONFIG,
    diasSemana: [],
    diasMes: [],
    ...(typeof plain === 'number' ? { frecuencia: Math.max(1, plain) } : {}),
  };
}

/** Config mínima de un ítem de rutina, fusionando con lo existente en el documento. */
export function ensureRutinaItemConfig(rutinaDoc, section, itemId) {
  return repairRutinaItemConfig(rutinaDoc.config?.[section]?.[itemId]);
}
