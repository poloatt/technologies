import React, { createContext, useContext } from 'react';
import useRutinaCadenceBucketController from '../hooks/useRutinaCadenceBucketController';

const RutinaCadenceViewContext = createContext(null);

/**
 * Estado compartido de la vista plana por cadencia (localData, toggles, buckets).
 * Evita prop-drilling FlatLayout → Franja/Weekly/Bucket → DayGroupList.
 */
export function RutinaCadenceViewProvider({ rutina, readOnly = false, children }) {
  const controller = useRutinaCadenceBucketController({ rutina, readOnly });
  return (
    <RutinaCadenceViewContext.Provider value={{ rutina, readOnly, ...controller }}>
      {children}
    </RutinaCadenceViewContext.Provider>
  );
}

export function useRutinaCadenceView() {
  const ctx = useContext(RutinaCadenceViewContext);
  if (!ctx) {
    throw new Error('useRutinaCadenceView must be used within RutinaCadenceViewProvider');
  }
  return ctx;
}

export function useRutinaCadenceViewOptional() {
  return useContext(RutinaCadenceViewContext);
}
