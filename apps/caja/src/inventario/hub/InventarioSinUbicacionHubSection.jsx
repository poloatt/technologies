import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import { INVENTARIO_HUB_PATHS, INVENTARIO_UBICACION } from './inventarioHubConstants';
import InventarioHubItemsPreview from './InventarioHubItemsPreview';
import { useInventarioHubItems } from './useInventarioHubItems';

export default function InventarioSinUbicacionHubSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, INVENTARIO_HUB_PATHS.sinUbicacion);
  const { items, loading } = useInventarioHubItems(INVENTARIO_UBICACION.SIN);

  return (
    <CajaHubSectionCard
      title="Sin locación"
      iconKey="inventario"
      path={INVENTARIO_HUB_PATHS.sinUbicacion}
      isActive={isActive}
    >
      <InventarioHubItemsPreview
        loading={loading}
        items={items}
        emptyLabel="Sin ítems sin ubicación"
        onRowClick={(e) => {
          e.stopPropagation();
          navigate(INVENTARIO_HUB_PATHS.sinUbicacion);
        }}
      />
    </CajaHubSectionCard>
  );
}
