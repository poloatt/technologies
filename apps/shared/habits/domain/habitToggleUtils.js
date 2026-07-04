/** Toggle de completitud (boolean legacy y objeto multi-horario). */

/**
 * Hábito diario que no puede marcarse desde el carrusel colapsado:
 * frecuencia > 1 o varias franjas horarias (no se sabe cuál marcar).
 */
export function habitRequiresExpandedCarouselToggle(config = {}) {
  const tipo = (config.tipo || 'DIARIO').toUpperCase();
  const periodo = (config.periodo || 'CADA_DIA').toUpperCase();
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  if (!isDaily) return false;

  const frecuencia = Number(config.frecuencia || 1);
  const horarios = Array.isArray(config.horarios) ? config.horarios.filter(Boolean) : [];
  return frecuencia > 1 || horarios.length > 1;
}

export function isFranjaCompleted(itemValue, normalizedHorario) {
  if (itemValue === undefined || itemValue === null || itemValue === false) return false;
  if (typeof itemValue === 'boolean') return itemValue === true;
  if (typeof itemValue === 'object' && !Array.isArray(itemValue)) {
    return itemValue[String(normalizedHorario).toUpperCase()] === true;
  }
  return false;
}

export function computeFranjaToggleValue({
  itemValue,
  horariosConfig = [],
  normalizedHorario,
}) {
  const horarios = horariosConfig.map((h) => String(h).toUpperCase());
  const horario = String(normalizedHorario).toUpperCase();
  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';

  if (isObjectFormat) {
    return {
      ...itemValue,
      [horario]: !isFranjaCompleted(itemValue, horario),
    };
  }

  const nextCompleted = !isFranjaCompleted(itemValue, horario);
  const newObject = {};

  if (isBooleanFormat && itemValue === true) {
    horarios.forEach((h) => {
      newObject[h] = h === horario ? nextCompleted : true;
    });
    return newObject;
  }

  horarios.forEach((h) => {
    if (h === horario) {
      newObject[h] = nextCompleted;
    } else {
      newObject[h] = isFranjaCompleted(itemValue, h);
    }
  });
  return newObject;
}

export function computeNextHabitValue({
  itemValue,
  itemConfig = {},
  horario = null,
  currentTimeOfDay = null,
  isCompletedForHorario = () => false,
}) {
  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';
  const horariosConfig = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];
  const hasMultipleHorarios = horariosConfig.length > 1;

  if (horario && horariosConfig.length > 0) {
    return computeFranjaToggleValue({
      itemValue,
      horariosConfig,
      normalizedHorario: String(horario).toUpperCase(),
    });
  }

  if (hasMultipleHorarios) {
    return computeFranjaToggleValue({
      itemValue,
      horariosConfig,
      normalizedHorario: String(currentTimeOfDay || horario).toUpperCase(),
    });
  }

  if (isObjectFormat) {
    const allCompleted = Object.values(itemValue).every(Boolean);
    return !allCompleted;
  }

  return !isCompletedForHorario();
}

export function computeCarouselToggleValue({
  itemValue,
  horariosConfig = [],
  normalizedHorario,
}) {
  const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);
  const isBooleanFormat = typeof itemValue === 'boolean';

  if (horariosConfig.length > 1 && normalizedHorario) {
    return computeFranjaToggleValue({
      itemValue,
      horariosConfig,
      normalizedHorario,
    });
  }

  const prev = isBooleanFormat
    ? itemValue
    : (isObjectFormat ? Object.values(itemValue).some(Boolean) : false);
  return !prev;
}
