import React from 'react';
import { Typography } from '@mui/material';
import { DirectionsCarOutlined } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import { INVENTARIO_HUB_PATHS } from './inventarioHubConstants';

/** Tarjeta Autos: navega a /propiedades/autos (sin icono en toolbar). */
export default function AutosHubSection() {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, INVENTARIO_HUB_PATHS.autos);

  return (
    <CajaHubSectionCard
      title="Autos"
      iconKey="auto"
      path={INVENTARIO_HUB_PATHS.autos}
      isActive={isActive}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 0.125, display: 'flex', alignItems: 'center', gap: 0.75 }}
      >
        <DirectionsCarOutlined sx={{ fontSize: 16, opacity: 0.7 }} />
        Próximamente: gestión de vehículos y flota
      </Typography>
    </CajaHubSectionCard>
  );
}
