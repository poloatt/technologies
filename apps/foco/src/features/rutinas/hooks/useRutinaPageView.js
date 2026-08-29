/**
 * @deprecated Vista por grupo retirada de la UI (ago 2026). RutinaTable usa solo cadencia.
 * Pendiente: eliminar este hook cuando no queden referencias.
 */
export const RUTINA_PAGE_VIEW = {
  group: 'group',
  cadence: 'cadence',
};

/** @deprecated Siempre devuelve cadencia. */
export function readStoredRutinaPageView() {
  return RUTINA_PAGE_VIEW.cadence;
}

/** @deprecated No-op; la alternancia de vista ya no está disponible. */
export function toggleRutinaPageView() {
  return RUTINA_PAGE_VIEW.cadence;
}

/** @deprecated Siempre cadencia. */
export default function useRutinaPageView() {
  return {
    viewMode: RUTINA_PAGE_VIEW.cadence,
    isCadenceView: true,
    isGroupView: false,
    toggleView: () => {},
  };
}
