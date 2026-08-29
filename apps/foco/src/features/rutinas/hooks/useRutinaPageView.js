import { useCallback, useEffect, useState } from 'react';

export const RUTINA_PAGE_VIEW = {
  group: 'group',
  cadence: 'cadence',
};

const STORAGE_KEY = 'foco.rutinas.pageView';

function readStoredView() {
  if (typeof window === 'undefined') return RUTINA_PAGE_VIEW.cadence;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === RUTINA_PAGE_VIEW.group ? RUTINA_PAGE_VIEW.group : RUTINA_PAGE_VIEW.cadence;
}

export { readStoredView as readStoredRutinaPageView };

export function toggleRutinaPageView(currentView = RUTINA_PAGE_VIEW.cadence) {
  const nextView = currentView === RUTINA_PAGE_VIEW.cadence
    ? RUTINA_PAGE_VIEW.group
    : RUTINA_PAGE_VIEW.cadence;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, nextView);
    window.dispatchEvent(new CustomEvent('rutinaSetPageView', { detail: { viewMode: nextView } }));
  }

  return nextView;
}

export default function useRutinaPageView() {
  const [viewMode, setViewMode] = useState(readStoredView);

  useEffect(() => {
    const syncFromStorage = () => setViewMode(readStoredView());

    const handleSetView = (event) => {
      const next = event.detail?.viewMode;
      if (next === RUTINA_PAGE_VIEW.group || next === RUTINA_PAGE_VIEW.cadence) {
        setViewMode(next);
      }
    };

    window.addEventListener('rutinaSetPageView', handleSetView);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('rutinaSetPageView', handleSetView);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const toggleView = useCallback(() => {
    setViewMode((current) => toggleRutinaPageView(current));
  }, []);

  return {
    viewMode,
    isCadenceView: viewMode === RUTINA_PAGE_VIEW.cadence,
    isGroupView: viewMode === RUTINA_PAGE_VIEW.group,
    toggleView,
  };
}
