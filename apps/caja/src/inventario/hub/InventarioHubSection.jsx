import React, { useMemo } from 'react';
import { Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard } from '../../hub';
import { INVENTARIO_HUB_PATHS, INVENTARIO_UBICACION } from './inventarioHubConstants';
import InventarioHubItemsPreview from './InventarioHubItemsPreview';
import { useInventarioHubItems } from './useInventarioHubItems';

/** Card Inventario en el hub Finanzas → /propiedades/inventario */
export default function InventarioHubSection() {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, INVENTARIO_HUB_PATHS.hub);

  const enPropiedades = useInventarioHubItems(INVENTARIO_UBICACION.PROPIEDAD);
  const sinUbicacion = useInventarioHubItems(INVENTARIO_UBICACION.SIN);

  const previewItems = useMemo(
    () => [...enPropiedades.items, ...sinUbicacion.items].slice(0, 3),
    [enPropiedades.items, sinUbicacion.items],
  );

  const loading = enPropiedades.loading || sinUbicacion.loading;
  const totalCount = enPropiedades.items.length + sinUbicacion.items.length;

  return (
    <CajaHubSectionCard
      title="Inventario"
      iconKey="inventario"
      path={INVENTARIO_HUB_PATHS.hub}
      isActive={isActive}
    >
      {loading ? (
        <InventarioHubItemsPreview loading items={[]} />
      ) : totalCount === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', px: 0.25 }}>
          Sin ítems registrados
        </Typography>
      ) : (
        <InventarioHubItemsPreview loading={false} items={previewItems} emptyLabel="Sin ítems" />
      )}
    </CajaHubSectionCard>
  );
}
