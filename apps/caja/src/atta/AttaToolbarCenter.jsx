import React, { useMemo } from 'react';
import { Box, Divider } from '@mui/material';
import { VisibilityOffOutlined, VisibilityOutlined } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { getIconByKey } from '@shared/navigation/menuIcons';
import { useEntityActions } from '@shared/components/common/CommonActions';
import {
  isCajaPageActive,
  resolveCajaToolbarCenterChildren,
} from '@shared/navigation/appNavResolver';
import { matchCajaSection } from './attaToolbarPaths';
import {
  CAJA_TOOLBAR_SETUP_PAGES,
  preloadCajaToolbarSetup,
} from './cajaToolbarSetups';
import { commonButtonSx } from './CajaSetupHost';
import { useCajaSetup } from './useCajaSetup';

/**
 * Cluster central Caja (centrado como Foco):
 * children del parent | visibilidad de montos | +
 */
export default function CajaToolbarCenter() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = matchCajaSection(pathname);
  const { getEntityConfig, showAddButton } = useEntityActions();
  const entityConfig = getEntityConfig();
  const { showValues, toggleValuesVisibility } = useValuesVisibility();
  const { setupId, openSetup } = useCajaSetup();
  const childPages = useMemo(
    () => resolveCajaToolbarCenterChildren(pathname),
    [pathname],
  );

  const childActions = useMemo(() => {
    if (!section) return [];

    return childPages.map((page) => {
      const opensSetup = !!CAJA_TOOLBAR_SETUP_PAGES[page.id];
      const isActive = opensSetup ? setupId === page.id : isCajaPageActive(pathname, page);
      const Icon = getIconByKey(page.iconKey);
      const disabled = page.isUnderConstruction;

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
        onMouseEnter: opensSetup && !disabled ? () => preloadCajaToolbarSetup(page.id) : undefined,
        onFocus: opensSetup && !disabled ? () => preloadCajaToolbarSetup(page.id) : undefined,
        onClick: disabled
          ? undefined
          : () => {
            if (opensSetup) openSetup(page.id);
            else navigate(page.path);
          },
      };
    });
  }, [childPages, navigate, openSetup, pathname, section, setupId]);

  const utilityActions = useMemo(() => ([
    {
      key: 'toggleValuesVisibility',
      icon: showValues ? <VisibilityOutlined /> : <VisibilityOffOutlined />,
      label: showValues ? 'Ocultar montos' : 'Mostrar montos',
      tooltip: showValues ? 'Ocultar montos' : 'Mostrar montos',
      color: showValues ? 'text.secondary' : 'primary.main',
      hoverColor: 'primary.main',
      buttonSx: {
        ...commonButtonSx,
        ...(!showValues && {
          bgcolor: 'action.selected',
          '&:hover': { bgcolor: 'action.selected' },
        }),
      },
      onClick: toggleValuesVisibility,
    },
  ]), [showValues, toggleValuesVisibility]);

  if (!section) return null;

  const hasChildren = childActions.length > 0;
  const hasUtilities = utilityActions.length > 0 || !!(showAddButton && entityConfig);
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
    </>
  );
}
