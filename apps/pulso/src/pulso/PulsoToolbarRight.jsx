import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { getIconByKey } from '@shared/navigation/menuIcons';
import useResponsive from '@shared/hooks/useResponsive';
import { matchPulsoSection } from './pulsoToolbarPaths';
import { getPulsoNavTargets } from './pulsoNavConfig';

/** Navegación derecha: Data / Nutrición / Lab. */
export default function PulsoToolbarRight() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useResponsive();
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

  const navActions = useMemo(() => {
    if (isMobile || !section) return [];

    return getPulsoNavTargets().map((target) => {
      const isActive = pathname === target.path || pathname.startsWith(`${target.path}/`);
      const Icon = getIconByKey(target.iconKey);
      return {
        key: `nav-${target.id}`,
        icon: <Icon />,
        label: target.label,
        tooltip: isActive ? target.label : `Ir a ${target.label}`,
        color: isActive ? 'primary.main' : 'text.secondary',
        hoverColor: 'primary.main',
        buttonSx: {
          ...commonButtonSx,
          ...(isActive && {
            bgcolor: 'action.selected',
            '&:hover': { bgcolor: 'action.selected' },
          }),
        },
        onClick: () => {
          if (!isActive) navigate(target.path);
        },
      };
    });
  }, [commonButtonSx, isMobile, navigate, pathname, section]);

  if (navActions.length === 0) return null;

  return <SystemButtons actions={navActions} gap={{ xs: 0.02, sm: 0.1 }} />;
}
