import { collectRutinaSectionKeys } from './habitSectionsUtils.js';
import { toPlainValue, ensureRutinaItemConfig } from './rutinaDocumentUtils.js';

export const RUTINA_UPDATE_SKIP_KEYS = new Set([
  '_id',
  'id',
  '__v',
  'createdAt',
  'updatedAt',
  'usuario',
  'completitud',
  'completitudPorSeccion',
  'metadata',
  'config',
  'fecha',
  '_metadata',
  'nombre',
  'notas',
  'tipo',
  'historial',
]);

function hasNewHabitCompletion(currentValue, nextValue) {
  const isObjectFormat = typeof nextValue === 'object' && nextValue !== null && !Array.isArray(nextValue);
  const isBooleanFormat = typeof nextValue === 'boolean';

  if (isObjectFormat) {
    const currentIsObject = typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue);
    return Object.entries(nextValue).some(([horario, completado]) => {
      if (completado !== true) return false;
      if (currentIsObject) return !currentValue[horario];
      return !currentValue;
    });
  }

  if (isBooleanFormat) {
    return nextValue === true && (!currentValue || currentValue === false);
  }

  return false;
}

export function collectRutinaUpdateSectionKeys(currentRutina, body) {
  return new Set([
    ...collectRutinaSectionKeys(currentRutina),
    ...Object.keys(body.config || {}),
    ...Object.keys(body).filter((key) => !RUTINA_UPDATE_SKIP_KEYS.has(key)),
  ]);
}

export function buildRutinaUpdatePatches(currentRutina, body, sectionKeys) {
  const sectionPatches = {};
  const configPatches = {};

  sectionKeys.forEach((section) => {
    if (!body[section] || typeof body[section] !== 'object' || Array.isArray(body[section])) return;
    sectionPatches[section] = toPlainValue(body[section]);
  });

  if (body.config) {
    Object.keys(body.config).forEach((seccion) => {
      if (seccion === '_metadata') return;
      if (!configPatches[seccion]) configPatches[seccion] = {};

      Object.keys(body.config[seccion]).forEach((item) => {
        const newItemConfig = toPlainValue(body.config[seccion][item]);
        const existingConfig = ensureRutinaItemConfig(currentRutina, seccion, item);
        configPatches[seccion][item] = {
          ...existingConfig,
          ...newItemConfig,
          frecuencia: Number(newItemConfig.frecuencia || existingConfig.frecuencia || 1),
        };
      });
    });
  }

  sectionKeys.forEach((section) => {
    if (!body[section]) return;

    Object.entries(body[section]).forEach(([key, value]) => {
      if (!hasNewHabitCompletion(currentRutina[section]?.[key], value)) return;

      if (!configPatches[section]) configPatches[section] = {};
      configPatches[section][key] = {
        ...ensureRutinaItemConfig(currentRutina, section, key),
        ...(configPatches[section][key] || {}),
        ultimaCompletacion: new Date(),
      };
    });
  });

  return { sectionPatches, configPatches };
}
