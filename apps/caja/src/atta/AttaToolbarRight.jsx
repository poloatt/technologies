import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getIconByKey } from '@shared/navigation/menuIcons';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import useResponsive from '@shared/hooks/useResponsive';
import { matchCajaSection } from './attaToolbarPaths';
import {
  resolveCajaToolbarRight,
  isCajaBranchActive,
} from '@shared/navigation/appNavResolver';

const commonButtonSx = {
  width: { xs: 32, sm: 26 },
  height: { xs: 32, sm: 26 },
  padding: { xs: 0.25, sm: 0.125 },
  minWidth: { xs: 32, sm: 26 },
  minHeight: { xs: 32, sm: 26 },
  '& .MuiSvgIcon-root': {
    fontSize: { xs: '1.1rem', sm: '1.1rem' },
  },
  '&:hover': { backgroundColor: 'action.hover' },
};

/** Toolbar derecha Atta (desktop): Finanzas | Propiedades | Inventario. */
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
