import React from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import {
  InventarioSectionNav,
  INVENTARIO_HUB_PATHS,
  INVENTARIO_UBICACION,
} from '../inventario';
import InventarioListView from '../inventario/InventarioListView';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

function resolveInventarioView(pathname) {
  if (pathname === INVENTARIO_HUB_PATHS.hub) {
    return { mode: 'hub' };
  }
  if (pathname === INVENTARIO_HUB_PATHS.enPropiedades) {
    return {
      mode: 'list',
      ubicacion: INVENTARIO_UBICACION.PROPIEDAD,
      title: 'Inventario en propiedades',
    };
  }
  if (pathname === INVENTARIO_HUB_PATHS.sinUbicacion) {
    return {
      mode: 'list',
      ubicacion: INVENTARIO_UBICACION.SIN,
      title: 'Inventario sin locación',
    };
  }
  return { mode: 'hub' };
}

export function Inventario({
  embedded = false,
  embeddedUbicacion,
  embeddedTitle,
} = {}) {
  const { pathname } = useLocation();
  const view = embedded && embeddedUbicacion
    ? { mode: 'list', ubicacion: embeddedUbicacion, title: embeddedTitle }
    : resolveInventarioView(pathname);

  return (
    <Box
      component={embedded ? 'div' : 'main'}
      className={embedded ? undefined : 'page-main-content'}
      sx={{
        ...(embedded ? { px: 1.5, py: 1.25 } : cajaPageLayoutSx),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!embedded && (
        <InventarioSectionNav variant={view.mode === 'hub' ? 'hub' : 'strip'} />
      )}

      {view.mode === 'list' && (
        <InventarioListView ubicacion={view.ubicacion} title={view.title} />
      )}
    </Box>
  );
}

export default Inventario;
