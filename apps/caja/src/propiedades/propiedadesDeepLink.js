export const PROPIEDADES_PATH = '/propiedades';

/** Navigation state to open PropiedadDetail on /propiedades (modal-only, no /:id route). */
export function propiedadDetailState(propiedadId, { habitacionId } = {}) {
  const id = propiedadId != null ? String(propiedadId) : null;
  if (!id) return {};
  return {
    selectedId: id,
    ...(habitacionId != null ? { selectedHabitacionId: String(habitacionId) } : {}),
  };
}
