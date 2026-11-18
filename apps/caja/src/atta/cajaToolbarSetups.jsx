import React from 'react';
import Cuentas from '../pages/Cuentas';
import Monedas from '../pages/Monedas';
import Contratos from '../pages/Contratos';
import Inquilinos from '../pages/Inquilinos';
import Inventario from '../pages/Inventario';
import {
  CUENTAS_PATH,
  MONEDAS_PATH,
} from '../finanzas/finanzasDeepLink';
import { INVENTARIO_UBICACION } from '../inventario';

/**
 * Páginas hijas que el toolbar centro abre como setup popup.
 * Clave = id de menuStructure.
 */
export const CAJA_TOOLBAR_SETUP_PAGES = {
  cuentas: {
    title: 'Cuentas',
    subtitle: 'Setup de Finanzas',
    path: CUENTAS_PATH,
    Component: Cuentas,
  },
  monedas: {
    title: 'Monedas',
    subtitle: 'Setup de Finanzas',
    path: MONEDAS_PATH,
    Component: Monedas,
  },
  contratos: {
    title: 'Contratos',
    subtitle: 'Setup de Propiedades',
    path: '/propiedades/contratos',
    Component: Contratos,
  },
  inquilinos: {
    title: 'Inquilinos',
    subtitle: 'Setup de Propiedades',
    path: '/propiedades/inquilinos',
    Component: Inquilinos,
  },
  'inventario-en-propiedades': {
    title: 'En propiedades',
    subtitle: 'Setup de Inventario',
    path: '/propiedades/inventario/en-propiedades',
    Component: Inventario,
    componentProps: {
      embeddedUbicacion: INVENTARIO_UBICACION.PROPIEDAD,
      embeddedTitle: 'Inventario en propiedades',
    },
  },
  'inventario-sin-ubicacion': {
    title: 'Sin locación',
    subtitle: 'Setup de Inventario',
    path: '/propiedades/inventario/sin-ubicacion',
    Component: Inventario,
    componentProps: {
      embeddedUbicacion: INVENTARIO_UBICACION.SIN,
      embeddedTitle: 'Inventario sin locación',
    },
  },
};

export function renderCajaToolbarSetup(pageId) {
  const setup = CAJA_TOOLBAR_SETUP_PAGES[pageId];
  if (!setup) return null;
  const { Component, componentProps } = setup;
  return <Component embedded {...(componentProps || {})} />;
}
