import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { ToolbarAddButton } from '@shared/components/common/ToolbarAddButton';
import { useActionHistory } from '@shared/context/ActionHistoryContext';
import { useUndoScope } from '@shared/hooks/useScopedUndo';
import { matchPulsoSection } from './pulsoToolbarPaths';

const ScopedUndoButton = SystemButtons.ScopedUndoButton;

/** Acciones de contexto Pulso (alta según la sección activa). */
export default function PulsoToolbarCenter() {
  const { pathname } = useLocation();
  const section = matchPulsoSection(pathname);
  const undoScope = useUndoScope();
  const { getUndoCountForScope } = useActionHistory();
  const undoCount = undoScope ? getUndoCountForScope(undoScope) : 0;

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
      data: { type: 'salud-item', tooltip: 'Nuevo ítem de salud' },
      nutricion: { type: 'nutricion', tooltip: 'Nueva receta' },
    };
    const add = addBySection[section];
    const undo = undoCount > 0 ? {
      key: 'undo',
      icon: <ScopedUndoButton buttonSx={commonButtonSx} scope={undoScope} />,
      label: 'Deshacer última acción',
      tooltip: `Deshacer última acción (${undoCount})`,
    } : null;
    if (!add && !undo) return [];

    return [
      ...(undo ? [undo] : []),
      ...(add ? [{
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
      }] : []),
    ];
  }, [commonButtonSx, section, undoCount, undoScope]);

  if (actions.length === 0) return null;

  return <SystemButtons actions={actions} gap={{ xs: 0.02, sm: 0.1 }} />;
}
