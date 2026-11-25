import { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_PERIOD_PRESET } from '../transacciones/transaccionesPeriodUtils';

const FinanzasHubPeriodContext = createContext(null);

/** Período compartido por todas las secciones del hub Finanzas. */
export function FinanzasHubPeriodProvider({ children }) {
  const [preset, setPreset] = useState(DEFAULT_PERIOD_PRESET);
  const value = useMemo(() => ({ preset, setPreset }), [preset]);
  return (
    <FinanzasHubPeriodContext.Provider value={value}>
      {children}
    </FinanzasHubPeriodContext.Provider>
  );
}

export function useFinanzasHubPeriod() {
  return useContext(FinanzasHubPeriodContext);
}

/**
 * En el hub Finanzas el período sale del provider.
 * Fuera de ese hub, la tarjeta compacta conserva su estado local
 * y la página usa el preset que le pasa el padre.
 */
export function useSectionPeriod({
  density = 'page',
  preset = DEFAULT_PERIOD_PRESET,
  onPresetChange,
}) {
  const dense = density === 'compact';
  const hubPeriod = useFinanzasHubPeriod();
  const [localHubPreset, setLocalHubPreset] = useState(DEFAULT_PERIOD_PRESET);
  const shared = dense && hubPeriod != null;
  const activePreset = shared ? hubPeriod.preset : (dense ? localHubPreset : preset);
  const changePreset = shared ? hubPeriod.setPreset : (dense ? setLocalHubPreset : onPresetChange);
  return {
    dense,
    activePreset,
    changePreset,
    showPeriodControl: !shared,
  };
}
