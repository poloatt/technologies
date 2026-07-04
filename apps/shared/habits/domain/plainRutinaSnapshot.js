const RUTINA_SNAPSHOT_SKIP_KEYS = new Set([
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

/**
 * Clona valores Mixed/Mongoose a objetos planos sin llamar toObject() del documento raíz.
 */
export function plainCloneDeep(value) {
  if (value == null) return value;

  if (typeof value.toObject === 'function') {
    try {
      return value.toObject({ flattenMaps: true, depopulate: true });
    } catch {
      // Continuar con clonado manual si el subdocumento está corrupto.
    }
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [key, plainCloneDeep(entry)]),
    );
  }

  if (Array.isArray(value)) {
    return value.map((entry) => plainCloneDeep(entry));
  }

  if (typeof value === 'object') {
    if (!(value instanceof Date)) {
      if (value.$__ != null && value._doc != null) {
        return plainCloneDeep(value._doc);
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, plainCloneDeep(entry)]),
      );
    }
  }

  return value;
}

/**
 * Snapshot plano de rutina para lógica de visibilidad sin serializar el documento Mongoose entero.
 */
export function toPlainRutinaSnapshot(rutina) {
  if (!rutina || typeof rutina !== 'object') return rutina;
  if (typeof rutina.toObject !== 'function') return rutina;

  const plain = { fecha: rutina.fecha };

  if (rutina.config) {
    plain.config = plainCloneDeep(rutina.config);
  }

  Object.keys(rutina).forEach((key) => {
    if (RUTINA_SNAPSHOT_SKIP_KEYS.has(key)) return;

    const value = rutina[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      plain[key] = plainCloneDeep(value);
    }
  });

  return plain;
}
