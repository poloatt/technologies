import React from 'react';
import { Box, Collapse } from '@mui/material';
import HubEmpty from './HubEmpty';
import HubExpandFooter from './HubExpandFooter';
import HubRow, { HubRowSkeleton } from './HubRow';
import { useHubPreviewSlice } from '../hooks/useHubPreviewSlice';

/**
 * Lista con preview + "Ver N más".
 * @param {object[]} items
 * @param {number} previewCount
 * @param {boolean} loading
 * @param {string} emptyLabel
 * @param {(item) => React.ReactNode} [renderRow] — por defecto usa HubRow con item.primary, etc. si no se pasa
 * @param {(e, item) => void} [onRowClick]
 */
export default function HubItemsPreview({
  items = [],
  previewCount = 3,
  loading = false,
  emptyLabel = 'Sin ítems',
  renderRow,
  onRowClick,
  expanded: controlledExpanded,
  onExpandedChange,
  preview: controlledPreview,
  rest: controlledRest,
  hasMore: controlledHasMore,
}) {
  const slice = useHubPreviewSlice(items, previewCount);
  const expanded = controlledExpanded ?? slice.expanded;
  const setExpanded = onExpandedChange ?? slice.setExpanded;
  const preview = controlledPreview ?? slice.preview;
  const rest = controlledRest ?? slice.rest;
  const hasMore = controlledHasMore ?? slice.hasMore;

  if (loading) {
    return (
      <>
        <HubRowSkeleton />
        <HubRowSkeleton />
      </>
    );
  }

  if (items.length === 0) {
    return <HubEmpty>{emptyLabel}</HubEmpty>;
  }

  const defaultRenderRow = (item) => (
    <HubRow
      key={item.id}
      icon={item.icon}
      primary={item.primary ?? item.nombre ?? 'Sin nombre'}
      secondary={item.secondary}
      trailing={item.trailing}
      trailingColor={item.trailingColor}
      onClick={onRowClick ? (e) => onRowClick(e, item) : undefined}
    />
  );

  const rowRenderer = renderRow ?? defaultRenderRow;

  return (
    <>
      {preview.map((item) => rowRenderer(item))}
      {hasMore && (
        <>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box>{rest.map((item) => rowRenderer(item))}</Box>
          </Collapse>
          <HubExpandFooter
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            restCount={rest.length}
          />
        </>
      )}
    </>
  );
}
