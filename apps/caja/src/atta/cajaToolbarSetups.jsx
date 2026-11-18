import React from 'react';
import Cuentas from '../pages/Cuentas';
import Monedas from '../pages/Monedas';
import {
  CUENTAS_PATH,
  MONEDAS_PATH,
} from '../finanzas/finanzasDeepLink';

/**
 * Páginas hijas que el toolbar centro abre como setup popup.
 * Solo setups de Finanzas (Cuentas / Monedas).
 * Propiedades e Inventario navegan a sus child pages (atrás → hub).
 * Clave = id de menuStructure.
 */
export const CAJA_TOOLBAR_SETUP_PAGES = {
  cuentas: {
    title: 'Cuentas',
    subtitle: 'Setup de Finanzas',
    path: CUENTAS_PATH,
    Component: Cuentas,
    /** Acciones del header del popup (misma UX que Finanzas: sync +). */
    headerActions: ['sync', 'add'],
    addEventType: 'cuentas',
  },
  monedas: {
    title: 'Monedas',
    subtitle: 'Setup de Finanzas',
    path: MONEDAS_PATH,
    Component: Monedas,
    headerActions: ['add'],
    addEventType: 'monedas',
  },
};

export function renderCajaToolbarSetup(pageId) {
  const setup = CAJA_TOOLBAR_SETUP_PAGES[pageId];
  if (!setup) return null;
  const { Component, componentProps } = setup;
  return <Component embedded {...(componentProps || {})} />;
}
