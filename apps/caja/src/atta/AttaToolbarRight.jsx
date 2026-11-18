import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getIconByKey } from '@shared/navigation/menuIcons';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import useResponsive from '@shared/hooks/useResponsive';
import {
  isCajaBranchActive,
  resolveCajaToolbarRight,
} from '@shared/navigation/appNavResolver';
import { matchCajaSection } from './attaToolbarPaths';
import { commonButtonSx } from './CajaSetupHost';

/**
 * Toolbar derecha Caja (desktop, misma posición/peso que Foco):
 * solo ramas parent — Finanzas | Propiedades | Inventario.
 */
export default function CajaToolbarRight() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useResponsive();
  const section = matchCajaSection(pathname);

  const { branches } = useMemo(
    () => resolveCajaToolbarRight(pathname),
    [pathname],
  );

  const branchActions = useMemo(() => {
    if (isMobile || !section) return [];

    return branches.map((branch) => {
      const isActive = isCajaBranchActive(pathname, branch);
      const Icon = getIconByKey(branch.iconKey);
      const disabled = branch.isUnderConstruction;
      return {
        key: branch.id,
        icon: <Icon />,
        label: branch.label,
        tooltip: disabled
          ? `${branch.label} (en construcción)`
          : (isActive ? branch.label : `Ir a ${branch.label}`),
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
        onClick: disabled ? undefined : () => navigate(branch.path),
      };
    });
  }, [branches, isMobile, navigate, pathname, section]);

  if (branchActions.length === 0) return null;

  return (
    <SystemButtons actions={branchActions} gap={{ xs: 0.02, sm: 0.1 }} />
  );
}
