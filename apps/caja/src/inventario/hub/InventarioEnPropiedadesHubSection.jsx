import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import { INVENTARIO_HUB_PATHS, INVENTARIO_UBICACION } from './inventarioHubConstants';
import InventarioHubItemsPreview from './InventarioHubItemsPreview';
import { useInventarioHubItems } from './useInventarioHubItems';

export default function InventarioEnPropiedadesHubSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, INVENTARIO_HUB_PATHS.enPropiedades);
  const { items, loading } = useInventarioHubItems(INVENTARIO_UBICACION.PROPIEDAD);

  return (
    <CajaHubSectionCard
      title="En propiedades"
      iconKey="apartment"
      path={INVENTARIO_HUB_PATHS.enPropiedades}
      isActive={isActive}
    >
      <InventarioHubItemsPreview
        loading={loading}
        items={items}
        emptyLabel="Sin ítems en propiedades"
        onRowClick={(e) => {
          e.stopPropagation();
          navigate(INVENTARIO_HUB_PATHS.enPropiedades);
        }}
      />
    </CajaHubSectionCard>
  );
}
