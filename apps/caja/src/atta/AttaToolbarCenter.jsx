import React, { useMemo } from 'react';
import { Box, Divider } from '@mui/material';
import { AutorenewOutlined } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { getIconByKey } from '@shared/navigation/menuIcons';
import { useEntityActions } from '@shared/components/common/CommonActions';
import { matchCajaSection } from './attaToolbarPaths';
import {
  resolveCajaToolbarCenter,
  isCajaPageActive,
} from '@shared/navigation/appNavResolver';

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
 * Toolbar centro Atta (móvil y desktop):
 * subpáginas de la rama activa + acciones de contexto (añadir, sincronizar).
 */
export default function CajaToolbarCenter() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = matchCajaSection(pathname);
  const { getEntityConfig, showAddButton } = useEntityActions();
  const entityConfig = getEntityConfig();

  const pages = useMemo(
    () => resolveCajaToolbarCenter(pathname),
    [pathname],
  );

  const pageActions = useMemo(() => {
    if (!section) return [];

    return pages.map((page) => {
      const isActive = isCajaPageActive(pathname, page);
      const Icon = getIconByKey(page.iconKey);
      const disabled = page.isUnderConstruction;
      return {
        key: page.id,
        icon: <Icon />,
        label: page.label,
        tooltip: disabled
          ? `${page.label} (en construcción)`
          : (isActive ? page.label : `Ir a ${page.label}`),
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
        onClick: disabled ? undefined : () => navigate(page.path),
      };
    });
  }, [navigate, pages, pathname, section]);

  const contextActions = useMemo(() => {
    const list = [];

    const isCuentasPage = [
      '/finanzas/cuentas',
      '/propiedades/cuentas',
      '/propiedades/inventario/cuentas',
    ].includes(pathname);

    if (isCuentasPage) {
      list.push({
        key: 'syncCuentas',
        icon: <AutorenewOutlined />,
        label: 'Sincronizar',
        tooltip: 'Sincronizar cuenta',
        color: 'primary.main',
        hoverColor: 'primary.main',
        buttonSx: commonButtonSx,
        onClick: () => window.dispatchEvent(new CustomEvent('openMercadoPagoConnect')),
      });
    }

    return list;
  }, [pathname]);

  if (!section) return null;

  const hasPages = pageActions.length > 0;
  const hasContext = contextActions.length > 0 || (showAddButton && entityConfig);

  if (!hasPages && !hasContext) return null;

  return (
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
      {hasPages && (
        <SystemButtons actions={pageActions} gap={{ xs: 0.02, sm: 0.1 }} />
      )}
      {hasPages && hasContext && (
        <Divider
          orientation="vertical"
          flexItem
          sx={{ mx: 0.5, alignSelf: 'center', height: 22, borderColor: 'divider' }}
        />
      )}
      {hasContext && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.02, sm: 0.1 } }}>
          <SystemButtons actions={contextActions} gap={{ xs: 0.02, sm: 0.1 }} />
          {showAddButton && entityConfig && (
            <SystemButtons.AddButton entityConfig={entityConfig} buttonSx={commonButtonSx} />
          )}
        </Box>
      )}
    </Box>
  );
}
