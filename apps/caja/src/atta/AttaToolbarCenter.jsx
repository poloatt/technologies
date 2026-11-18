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

/**
 * Toolbar centro Atta: children del parent activo (menu principal).
 * Ramas → footer móvil / toolbar derecha desktop.
 * Actions (sync, +) aparte de los children.
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
        tooltip: disabled
          ? `${page.label} (en construcción)`
          : page.label,
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
            if (opensSetup) {
              setOpenSetupId(page.id);
              return;
            }
            navigate(page.path);
          },
      };
    });
  }, [childPages, navigate, pathname, section]);

  // Sync disponible en todos los children de Finanzas (junto al +).
  // El modal vive acá: Cuentas puede no estar montada.
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

  const openSetup = openSetupId ? CAJA_TOOLBAR_SETUP_PAGES[openSetupId] : null;

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.02, sm: 0.1 },
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {hasChildren && (
          <SystemButtons actions={childActions} gap={{ xs: 0.02, sm: 0.1 }} />
        )}
        {hasChildren && hasUtilities && (
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: 0.5, alignSelf: 'center', height: 22, borderColor: 'divider' }}
          />
        )}
        {hasUtilities && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.02, sm: 0.1 } }}>
            {utilityActions.length > 0 && (
              <SystemButtons actions={utilityActions} gap={{ xs: 0.02, sm: 0.1 }} />
            )}
            {showAddButton && entityConfig && (
              <SystemButtons.AddButton entityConfig={entityConfig} buttonSx={commonButtonSx} />
            )}
          </Box>
        )}
      </Box>
      <SetupPageDialog
        open={!!openSetup}
        onClose={() => setOpenSetupId(null)}
        title={openSetup?.title || ''}
        subtitle={openSetup?.subtitle}
        fullPagePath={openSetup?.path}
      >
        {openSetupId ? renderCajaToolbarSetup(openSetupId) : null}
      </SetupPageDialog>
      <MercadoPagoSyncDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
      />
    </>
  );
}
