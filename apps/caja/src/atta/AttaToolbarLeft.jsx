import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { matchCajaSection } from './attaToolbarPaths';
import {
  resolveCajaBranchHubPath,
  resolveCajaBranchHubLabel,
} from '@shared/navigation/appNavResolver';

/** Ancho del slot del botón atrás (debe coincidir con AgendaUnifiedBar). */
export const CAJA_BACK_SLOT_WIDTH_PX = { xs: 32, sm: 26 };

const commonButtonSx = {
  width: { xs: CAJA_BACK_SLOT_WIDTH_PX.xs, sm: CAJA_BACK_SLOT_WIDTH_PX.sm },
  height: { xs: CAJA_BACK_SLOT_WIDTH_PX.xs, sm: CAJA_BACK_SLOT_WIDTH_PX.sm },
  padding: { xs: 0.25, sm: 0.125 },
  minWidth: { xs: CAJA_BACK_SLOT_WIDTH_PX.xs, sm: CAJA_BACK_SLOT_WIDTH_PX.sm },
  minHeight: { xs: CAJA_BACK_SLOT_WIDTH_PX.xs, sm: CAJA_BACK_SLOT_WIDTH_PX.sm },
  '& .MuiSvgIcon-root': { fontSize: { xs: '1.1rem', sm: '1.1rem' } },
  '&:hover': { backgroundColor: 'action.hover' },
};

const backSlotSx = {
  width: { xs: CAJA_BACK_SLOT_WIDTH_PX.xs, sm: CAJA_BACK_SLOT_WIDTH_PX.sm },
  height: { xs: CAJA_BACK_SLOT_WIDTH_PX.xs, sm: CAJA_BACK_SLOT_WIDTH_PX.sm },
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Toolbar izquierda Atta: botón «atrás» al hub de rama (Finanzas / Propiedades / Inventario).
 * El slot se reserva siempre; el botón solo se muestra fuera del hub.
 */
export default function CajaToolbarLeft() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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

  if (!section) return null;

  return (
    <Box sx={backSlotSx} aria-hidden={!backAction}>
      {backAction ? <SystemButtons actions={[backAction]} gap={0.25} /> : null}
    </Box>
  );
}
