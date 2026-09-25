import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { ToolbarAddButton } from '@shared/components/common/ToolbarAddButton';
import { matchPulsoSection } from './pulsoToolbarPaths';

/** Acciones de contexto Pulso (p. ej. nuevo registro en data corporal). */
export default function PulsoToolbarCenter() {
  const { pathname } = useLocation();
  const section = matchPulsoSection(pathname);

  const commonButtonSx = useMemo(() => ({
    width: { xs: 32, sm: 26 },
    height: { xs: 32, sm: 26 },
    padding: { xs: 0.25, sm: 0.125 },
    minWidth: { xs: 32, sm: 26 },
    minHeight: { xs: 32, sm: 26 },
    '& .MuiSvgIcon-root': { fontSize: { xs: '1.1rem', sm: '1.1rem' } },
    '&:hover': { backgroundColor: 'action.hover' },
  }), []);

  const actions = useMemo(() => {
    const addBySection = {
      datacorporal: { type: 'data-corporal', tooltip: 'Nuevo registro' },
      dieta: { type: 'dieta', tooltip: 'Nueva receta' },
      lab: { type: 'salud-item', tooltip: 'Nuevo ítem de salud' },
    };
    const add = addBySection[section];
    if (!add) return [];

    return [
      {
        key: 'add',
        icon: (
          <ToolbarAddButton
            buttonSx={commonButtonSx}
            aria-label={add.tooltip}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('headerAddButtonClicked', {
                detail: { type: add.type },
              }));
            }}
          />
        ),
        label: add.tooltip,
      },
    ];
  }, [commonButtonSx, section]);

  if (actions.length === 0) return null;

  return <SystemButtons actions={actions} gap={{ xs: 0.02, sm: 0.1 }} />;
}
