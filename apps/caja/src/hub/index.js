export { HubSectionCard as CajaHubSectionCard } from '@shared/components/hub';

export * from './styles/attaHubSectionStyles';
export * from './styles/attaPropiedadHubStyles';
export * from './styles/attaHubChipStyles';

export { default as HubRow, HubRowSkeleton } from './components/HubRow';
export { HUB_ROW_LAYOUT } from './components/hubRowLayout';
export { default as HubItemsPreview } from './components/HubItemsPreview';
export { default as HubExpandFooter } from './components/HubExpandFooter';
export { default as HubEmpty } from './components/HubEmpty';
export { default as HubMetricsRow, MetricChip, hubMetricsRowSx } from './components/HubMetricsRow';

export { useHubPreviewSlice } from './hooks/useHubPreviewSlice';

// Branch registry: import from `./config/attaHubBranchConfig` (not this barrel) to avoid
// circular init with domain *HubSection modules that import from `../../hub`.
