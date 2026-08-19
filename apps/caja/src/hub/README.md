# Atta Hub Kit

Punto único de verdad para **componentes y lógica** de hubs de **Finanzas**, **Propiedades** e **Inventario**.

Los **estilos core** y el **shell de tarjeta** viven en `@attadia/shared`:

| Recurso | Import |
|---------|--------|
| Tokens y sx (header, body, card, subsección) | `@shared/styles/hubSectionStyles` |
| `HubSectionCard`, `HubSectionHeader`, `HubSectionShell` | `@shared/components/hub` |
| Alias ATTA | `AttaHubSectionCard` desde `@/hub` (= `HubSectionCard`) |

Estilos **solo ATTA** (Propiedades, switch compacto): `@/hub/styles/attaPropiedadHubStyles`.

Chips, filas y carruseles hub: `@/hub/styles/attaHubChipStyles`.

`@/hub/styles/attaHubSectionStyles` re-exporta aliases `@deprecated` hacia shared; preferir imports directos de `@shared/styles/hubSectionStyles`.

Registro de ramas: `getAttaHubBranchConfig` desde `@/hub/config/attaHubBranchConfig` (**no** desde `@/hub`), para no crear dependencia circular con `*HubSection`.

## Importar

```js
import {
  AttaHubSectionCard,
  HubItemsPreview,
  HubRow,
  useHubPreviewSlice,
  getHubChipSx,
} from '@/hub';
```

## Checklist PR3 (sin shims)

- [x] `finance/` y `bienes/` eliminados; dominios en `finanzas/`, `propiedades/`, `inventario/`
- [x] Tarjeta hub: `AttaHubSectionCard` desde `@/hub` (wrapper de `@shared/components/hub`)
- [x] Estilos core hub: `@shared/styles/hubSectionStyles` (aliases deprecated en `hub/styles/attaHubSectionStyles`)
- [x] Filas hub: `HubRow` desde `@/hub` (no `BienesHubRow`)
- [x] Nav Atta: `getAttaBranchPropiedades` / `getAttaPropiedadesNav` (no aliases `bienes`)

## Nueva sección hub

1. **Menú:** ítem en `apps/shared/navigation/menuStructure.js` bajo la rama (`finanzas` | `propiedades` | `inventario`).
2. **Meta (opcional):** entrada en `*SectionMeta.js` de la rama.
3. **Componente:** `XxxHubSection.jsx` en dominio (`finanzas/hub/`, `propiedades/hub/`, `inventario/hub/`):

```jsx
export default function XxxHubSection() {
  const { items, loading } = useXxxData();
  return (
    <AttaHubSectionCard title="..." iconKey="..." path="..." isActive={...}>
      <HubItemsPreview loading={loading} items={items} emptyLabel="Sin datos" />
    </AttaHubSectionCard>
  );
}
```

4. **Registro:** `page.id: XxxHubSection` en `hub/config/attaHubBranchConfig.js` → `hubSectionCards`.
5. **Toolbar:** si la navegación es solo in-page, añadir `page.id` a `*_TOOLBAR_EXCLUDE_PAGE_IDS` en `appNavResolver.js`.
6. **Stats (opcional):** endpoint en `*StatsEndpoints.js` solo para tarjetas genéricas sin componente custom.

## Widgets compartidos entre ramas

| Widget | Origen | Consumidores típicos |
|--------|--------|----------------------|
| `MonedasCarousel`, `MonedaTile` | `finanzas/monedas` | `finanzas/hub/MonedasHubSection`, `propiedades/hub/*`, `HabitacionesCarouselSection` |

Importar desde el barrel del dominio, p. ej. `import { MonedasCarousel } from '../../finanzas/monedas'`.

## Variantes de layout

| Variante | Primitive |
|----------|-----------|
| Lista con expand | `HubItemsPreview` + `useHubPreviewSlice` |
| Carrusel | `hubCarouselSx` + tiles de dominio |
| Métricas | `HubMetricsRow` + `MetricChip` |
| Custom | cuerpo libre dentro de `AttaHubSectionCard` |

Cambios globales de look → `@shared/styles/hubSectionStyles`. Chips/filas → `hub/styles/attaHubChipStyles`.
