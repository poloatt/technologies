import React, { useMemo, useState } from 'react';
import { AddOutlined, AutorenewOutlined } from '@mui/icons-material';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import SetupPageDialog from '../finanzas/SetupPageDialog';
import { MercadoPagoSyncDialog } from '../finanzas/conexiones';
import {
  CAJA_TOOLBAR_SETUP_PAGES,
  renderCajaToolbarSetup,
} from './cajaToolbarSetups';

const commonButtonSx = {
  width: { xs: 32, sm: 26 },
  height: { xs: 32, sm: 26 },
  padding: { xs: 0.25, sm: 0.125 },
  minWidth: { xs: 32, sm: 26 },
  minHeight: { xs: 32, sm: 26 },
  '& .MuiSvgIcon-root': { fontSize: { xs: '1.1rem', sm: '1.1rem' } },
  '&:hover': { backgroundColor: 'action.hover' },
};

function dispatchSetupAdd(setup) {
  window.dispatchEvent(new CustomEvent('headerAddButtonClicked', {
    detail: {
      type: setup?.addEventType || setup?.id,
      path: setup?.path,
    },
  }));
}

/**
 * Host compartido de popups setup (+ sync/add en header del dialog).
 */
export default function CajaSetupHost({ openSetupId, onCloseSetup }) {
  const [syncOpen, setSyncOpen] = useState(false);
  const openSetup = openSetupId ? CAJA_TOOLBAR_SETUP_PAGES[openSetupId] : null;

  const setupHeaderActions = useMemo(() => {
    if (!openSetup?.headerActions?.length) return null;
    const actions = [];
    if (openSetup.headerActions.includes('sync')) {
      actions.push({
        key: 'setup-sync',
        icon: <AutorenewOutlined />,
        label: 'Sincronizar',
        tooltip: 'Sincronizar cuenta',
        color: 'primary.main',
        hoverColor: 'primary.main',
        buttonSx: commonButtonSx,
        onClick: () => setSyncOpen(true),
      });
    }
    if (openSetup.headerActions.includes('add')) {
      actions.push({
        key: 'setup-add',
        icon: <AddOutlined />,
        label: 'Agregar',
        tooltip: `Nueva ${openSetup.title?.toLowerCase?.() || 'entrada'}`,
        color: 'primary.main',
        hoverColor: 'primary.main',
        buttonSx: commonButtonSx,
        onClick: () => dispatchSetupAdd(openSetup),
      });
    }
    if (!actions.length) return null;
    return <SystemButtons actions={actions} gap={{ xs: 0.02, sm: 0.1 }} />;
  }, [openSetup]);

  return (
    <>
      <SetupPageDialog
        open={!!openSetup}
        onClose={onCloseSetup}
        title={openSetup?.title || ''}
        subtitle={openSetup?.subtitle}
        fullPagePath={openSetup?.path || null}
        headerActions={setupHeaderActions}
      >
        {openSetupId ? renderCajaToolbarSetup(openSetupId) : null}
      </SetupPageDialog>
      <MercadoPagoSyncDialog open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}

export { commonButtonSx, dispatchSetupAdd };
