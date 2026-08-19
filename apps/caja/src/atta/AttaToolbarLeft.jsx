import React, { useMemo } from 'react';
import { ArrowBack } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import useResponsive from '@shared/hooks/useResponsive';
import { matchCajaSection } from './attaToolbarPaths';
import {
  resolveCajaBranchHubPath,
  resolveCajaBranchHubLabel,
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
 * Toolbar izquierda Atta: botón «atrás» al hub de rama (Finanzas / Propiedades / Inventario).
 * Se muestra junto al menú lateral, no en el centro.
 */
export default function CajaToolbarLeft() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useResponsive();
  const section = matchCajaSection(pathname);

  const branchHubPath = useMemo(
    () => resolveCajaBranchHubPath(pathname),
    [pathname],
  );
  const branchHubLabel = useMemo(
    () => resolveCajaBranchHubLabel(pathname),
    [pathname],
  );

  const backAction = useMemo(() => {
    if (!branchHubPath) return null;
    return {
      key: 'branchBack',
      icon: <ArrowBack />,
      label: branchHubLabel || 'Volver',
      tooltip: `Volver a ${branchHubLabel || 'hub'}`,
      color: 'text.secondary',
      hoverColor: 'primary.main',
      buttonSx: commonButtonSx,
      onClick: () => navigate(branchHubPath),
    };
  }, [branchHubPath, branchHubLabel, navigate]);

  if (isMobile || !section || !backAction) return null;

  return <SystemButtons actions={[backAction]} gap={0.25} />;
}
