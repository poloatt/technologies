import React, { useMemo, useState } from 'react';
import { Box, Divider } from '@mui/material';
import { AutorenewOutlined } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { getIconByKey } from '@shared/navigation/menuIcons';
import { useEntityActions } from '@shared/components/common/CommonActions';
import {
  isCajaPageActive,
  resolveCajaToolbarCenterChildren,
} from '@shared/navigation/appNavResolver';
import { matchCajaSection } from './attaToolbarPaths';
import { MercadoPagoSyncDialog } from '../finanzas/conexiones';
import { CAJA_TOOLBAR_SETUP_PAGES } from './cajaToolbarSetups';
import CajaSetupHost, { commonButtonSx } from './CajaSetupHost';

/**
 * Cluster central Caja (centrado como Foco):
 * children del parent | sync | +
 */
export default function CajaToolbarCenter() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = matchCajaSection(pathname);
  const { getEntityConfig, showAddButton } = useEntityActions();
  const entityConfig = getEntityConfig();
  const [openSetupId, setOpenSetupId] = useState(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const childPages = useMemo(
    () => resolveCajaToolbarCenterChildren(pathname),
    [pathname],
  );

  const childActions = useMemo(() => {
    if (!section) return [];

    return childPages.map((page) => {
      const isActive = isCajaPageActive(pathname, page);
      const Icon = getIconByKey(page.iconKey);
      const disabled = page.isUnderConstruction;
      const opensSetup = !!CAJA_TOOLBAR_SETUP_PAGES[page.id];

      return {
        key: page.id,
        icon: <Icon />,
        label: page.label,
        tooltip: disabled ? `${page.label} (en construcción)` : page.label,
        color: disabled ? 'text.disabled' : (isActive ? 'primary.main' : 'text.secondary'),
        hoverColor: disabled ? 'text.disabled' : 'primary.main',
        disabled,
        buttonSx: {
          ...commonButtonSx,
          opacity: disabled ? 0.45 : 1,
          ...(isActive && !disabled && {
            bgcolor: 'action.selected',
            '&:hover': { bgcolor: 'action.selected' },
          }),
        },
        onClick: disabled
          ? undefined
          : () => {
            if (opensSetup) setOpenSetupId(page.id);
            else navigate(page.path);
          },
      };
    });
  }, [childPages, navigate, pathname, section]);

  const utilityActions = useMemo(() => {
    if (section !== 'finanzas') return [];
    return [{
      key: 'syncCuentas',
      icon: <AutorenewOutlined />,
      label: 'Sincronizar',
      tooltip: 'Sincronizar cuenta',
      color: 'primary.main',
      hoverColor: 'primary.main',
      buttonSx: commonButtonSx,
      onClick: () => setSyncOpen(true),
    }];
  }, [section]);

  if (!section) return null;

  const hasChildren = childActions.length > 0;
  const hasUtilities = utilityActions.length > 0 || (showAddButton && entityConfig);
  if (!hasChildren && !hasUtilities) return null;

  return (
    <>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.15, sm: 0.25 },
          maxWidth: '100%',
        }}
      >
        {hasChildren && (
          <SystemButtons actions={childActions} gap={{ xs: 0.02, sm: 0.1 }} />
        )}
        {hasChildren && hasUtilities && (
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: { xs: 0.35, sm: 0.6 }, alignSelf: 'center', height: 22, borderColor: 'divider' }}
          />
        )}
        {hasUtilities && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: { xs: 0.02, sm: 0.1 } }}>
            {utilityActions.length > 0 && (
              <SystemButtons actions={utilityActions} gap={{ xs: 0.02, sm: 0.1 }} />
            )}
            {showAddButton && entityConfig && (
              <SystemButtons.AddButton entityConfig={entityConfig} buttonSx={commonButtonSx} />
            )}
          </Box>
        )}
      </Box>
      <CajaSetupHost
        openSetupId={openSetupId}
        onCloseSetup={() => setOpenSetupId(null)}
      />
      <MercadoPagoSyncDialog open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}
