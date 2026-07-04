import { resolveItemVisibility } from '../domain/resolveItemVisibility.js';
import { parseAPIDate } from '../../utils/dateUtils.js';
import { getCurrentTimeOfDay } from '../../utils/timeOfDayUtils.js';

const buildRutinaForCheck = (rutina, section, itemId, config, localData = {}) => {
  const fecha = parseAPIDate(rutina?.fecha) || new Date();
  const completadoHoy = localData[itemId] !== undefined
    ? localData[itemId]
    : (rutina?.[section]?.[itemId] !== undefined ? rutina[section][itemId] : false);

  const mergedConfig = {
    ...(rutina?.config || {}),
    [section]: {
      ...(rutina?.config?.[section] || {}),
      [itemId]: config,
    },
  };

  return {
    ...rutina,
    fecha: fecha.toISOString(),
    config: mergedConfig,
    [section]: {
      ...(rutina?.[section] || {}),
      [itemId]: completadoHoy,
    },
    historial: rutina?.historial || {},
  };
};

export const shouldShowItemSync = (section, itemId, rutina, config, localData = {}, currentTimeOfDay = null) => {
  try {
    if (!section || !itemId || !rutina) return true;
    const rutinaCheck = buildRutinaForCheck(rutina, section, itemId, config, localData);
    const timeOfDay = currentTimeOfDay || getCurrentTimeOfDay();
    const isCompleted = localData[itemId] !== undefined
      ? localData[itemId]
      : (rutina?.[section]?.[itemId] !== undefined ? rutina[section][itemId] : false);

    return resolveItemVisibility(section, itemId, rutinaCheck, {
      historial: rutina?.historial || {},
      currentTimeOfDay: timeOfDay,
      isCompleted,
    });
  } catch (e) {
    console.error('[visibilityUtils] Error en shouldShowItemSync:', e);
    return true;
  }
};

export const getVisibleItemIds = (sectionIcons, section, rutina, config, localData = {}, currentTimeOfDay = null) => {
  const itemIds = Object.keys(sectionIcons || {});
  return itemIds.filter((itemId) => {
    const itemConfig = config?.[itemId];
    if (itemConfig?.activo === false) return false;
    return shouldShowItemSync(section, itemId, rutina, itemConfig || {}, localData, currentTimeOfDay);
  });
};
