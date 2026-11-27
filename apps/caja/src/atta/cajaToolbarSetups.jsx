import React, { Suspense } from 'react';
import { Box, Skeleton } from '@mui/material';
import { HUB_SECTION, getHubSubsectionSx } from '@shared/styles/hubSectionStyles';

const SETUP_LOADERS = {
  cuentas: () => import('../finanzas/cuentas/CuentasSetup'),
  monedas: () => import('../finanzas/monedas/MonedasSetup'),
  contactos: () => import('../finanzas/contactos/ContactosSetup'),
};

const preloadCache = new Map();

function loadSetupModule(pageId) {
  const loader = SETUP_LOADERS[pageId];
  if (!loader) return null;
  if (!preloadCache.has(pageId)) {
    preloadCache.set(pageId, loader());
  }
  return preloadCache.get(pageId);
}

/**
 * Precarga el chunk de un popup setup (ideal para hover/focus en la toolbar).
 */
export function preloadCajaToolbarSetup(pageId) {
  return loadSetupModule(pageId);
}

const CuentasSetup = React.lazy(() => loadSetupModule('cuentas'));
const MonedasSetup = React.lazy(() => loadSetupModule('monedas'));
const ContactosSetup = React.lazy(() => loadSetupModule('contactos'));

function SetupSuspenseFallback() {
  return (
    <Box sx={{ px: HUB_SECTION.bodyPx, py: HUB_SECTION.bodyPy }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 1,
          pb: 1.25,
          mb: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={38}
            sx={{ borderRadius: 0, bgcolor: 'action.hover' }}
          />
        ))}
      </Box>
      <Skeleton
        variant="rectangular"
        height={32}
        sx={{ mb: 1.25, borderRadius: 0, bgcolor: 'action.hover' }}
      />
      <Box sx={{ ...getHubSubsectionSx(), overflow: 'hidden' }}>
        {[0, 1, 2, 3].map((idx) => (
          <Box
            key={idx}
            sx={{
              borderBottom: idx < 3 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Skeleton
              variant="rectangular"
              height={44}
              sx={{ borderRadius: 0, bgcolor: 'action.hover' }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Setups de Finanzas (Cuentas / Monedas / Contactos): solo existen como popup, sin página.
 * Se abren con `useCajaSetup().openSetup(id)` (query param `?setup=id`).
 * Propiedades e Inventario navegan a sus child pages (atrás → hub).
 * Clave = id de menuStructure.
 */
export const CAJA_TOOLBAR_SETUP_PAGES = {
  cuentas: {
    title: 'Cuentas',
    subtitle: 'Setup de Finanzas',
    Component: CuentasSetup,
    /** Acciones del header del popup (misma UX que Finanzas: sync +). */
    headerActions: ['sync', 'add'],
    addEventType: 'cuentas',
  },
  monedas: {
    title: 'Monedas',
    subtitle: 'Setup de Finanzas',
    Component: MonedasSetup,
    headerActions: ['add'],
    addEventType: 'monedas',
  },
  contactos: {
    title: 'Contactos',
    subtitle: 'Setup de Finanzas',
    Component: ContactosSetup,
    headerActions: ['backfill', 'add'],
    addEventType: 'contactos',
  },
};

export function renderCajaToolbarSetup(pageId) {
  const setup = CAJA_TOOLBAR_SETUP_PAGES[pageId];
  if (!setup) return null;
  const { Component, componentProps } = setup;
  return (
    <Suspense fallback={<SetupSuspenseFallback />}>
      <Component {...(componentProps || {})} />
    </Suspense>
  );
}
