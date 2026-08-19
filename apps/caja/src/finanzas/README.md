# Finanzas (Atta)

Módulo de dinero: transacciones, cuentas, monedas, recurrente, inversiones, deudores y conexiones bancarias.

## Estructura

- `FinanzasSectionNav.jsx` — navegación hub / strip
- `finanzasSectionMeta.js`, `finanzasStatsEndpoints.js`, `finanzasDeepLink.js`
- `hub/` — tarjetas del hub (`*HubSection.jsx`); registradas en `@/hub/config/attaHubBranchConfig`
- `transacciones/`, `cuentas/`, `monedas/`, `recurrente/`, `conexiones/` — dominio y formularios
- `pages/Finanzas.jsx`, `Transacciones.jsx`, … — shells de ruta que importan desde `../finanzas`

## Hub kit

Usar `AttaHubSectionCard`, `HubItemsPreview`, etc. desde `@/hub`, no shims locales.

## Widgets compartidos (`monedas/`)

`MonedasCarousel`, `MonedaTile`, `normalizeMoneda` y utilidades de orden viven en `finanzas/monedas`. Se reutilizan en:

- `finanzas/hub/MonedasHubSection`
- `propiedades/hub/*` y `HabitacionesCarouselSection`

Importar desde el barrel `../finanzas` o `finanzas/monedas`; no duplicar en `propiedades/`. Detalle en `@/hub` README (tabla cross-rama).
