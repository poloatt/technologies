import { shouldShowRutinaItem, getHabitCompletionSlotCount, getHabitCompletedSlotCount } from '@attadia/shared/habits';
import { collectRutinaSectionKeys } from './habitSectionsUtils.js';
import { toPlainValue, repairRutinaItemConfig } from './rutinaDocumentUtils.js';
import { toPlainRutinaSnapshot } from '@attadia/shared/habits';

export function buildRutinaUpdateSetOps(patches, body, currentRutina) {
  const $set = {};
  const { sectionPatches, configPatches } = patches;

  Object.entries(sectionPatches).forEach(([section, items]) => {
    Object.entries(items).forEach(([itemId, itemValue]) => {
      $set[`${section}.${itemId}`] = toPlainValue(itemValue);
    });
  });

  Object.entries(configPatches).forEach(([section, items]) => {
    Object.entries(items).forEach(([itemId, itemConfig]) => {
      Object.entries(toPlainValue(itemConfig)).forEach(([key, value]) => {
        $set[`config.${section}.${itemId}.${key}`] = toPlainValue(value);
      });
    });
  });

  if (body.fecha) {
    $set.fecha = body.fecha;
  }

  if (body.historial && typeof body.historial === 'object') {
    $set.historial = {
      ...toPlainValue(currentRutina.historial),
      ...toPlainValue(body.historial),
    };
  }

  if (body.postponedFranjas && typeof body.postponedFranjas === 'object') {
    $set.postponedFranjas = toPlainValue(body.postponedFranjas);
  }

  if (body.habitDeferrals && typeof body.habitDeferrals === 'object') {
    $set.habitDeferrals = toPlainValue(body.habitDeferrals);
  }

  return $set;
}

export function calculateRutinaCompletitud(rutinaDoc) {
  const rutina = toPlainRutinaSnapshot(rutinaDoc);
  const sections = collectRutinaSectionKeys(rutina);
  const completitudPorSeccion = {};
  let totalTasks = 0;
  let completedTasks = 0;

  sections.forEach((section) => {
    const sectionData = rutina[section] && typeof rutina[section] === 'object'
      ? rutina[section]
      : {};
    const sectionFields = Object.keys(sectionData);
    let sectionTotal = 0;
    let sectionCompleted = 0;

    sectionFields.forEach((field) => {
      const itemConfig = repairRutinaItemConfig(rutina.config?.[section]?.[field]);
      rutina.config = rutina.config || {};
      rutina.config[section] = rutina.config[section] || {};
      rutina.config[section][field] = itemConfig;

      if (!shouldShowRutinaItem(section, field, rutina)) return;

      const fieldValue = sectionData[field];
      const isObjectFormat = typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue);
      const isBooleanFormat = typeof fieldValue === 'boolean';

      if (isObjectFormat || isBooleanFormat) {
        sectionTotal += getHabitCompletionSlotCount(fieldValue, itemConfig);
        sectionCompleted += getHabitCompletedSlotCount(fieldValue, itemConfig);
      } else {
        sectionTotal += 1;
      }
    });

    completitudPorSeccion[section] = sectionTotal > 0 ? sectionCompleted / sectionTotal : 0;
    totalTasks += sectionTotal;
    completedTasks += sectionCompleted;
  });

  return {
    completitud: totalTasks > 0 ? completedTasks / totalTasks : 0,
    completitudPorSeccion,
  };
}
