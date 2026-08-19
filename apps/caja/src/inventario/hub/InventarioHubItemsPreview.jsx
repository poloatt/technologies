import React from 'react';
import { Inventory2Outlined } from '@mui/icons-material';
import { HubItemsPreview } from '../../hub';
import HubRow from '../../hub/components/HubRow';
import { INVENTARIO_HUB_PREVIEW_COUNT } from './inventarioHubConstants';
import { getInventarioRowSecondary } from './inventarioHubUtils';

/** Preview de inventario en hub; delega en HubItemsPreview del kit. */
export default function InventarioHubItemsPreview({
  loading,
  items,
  emptyLabel = 'Sin ítems',
  onRowClick,
  previewCount = INVENTARIO_HUB_PREVIEW_COUNT,
}) {
  return (
    <HubItemsPreview
      loading={loading}
      items={items}
      previewCount={previewCount}
      emptyLabel={emptyLabel}
      renderRow={(item) => (
        <HubRow
          key={item.id}
          icon={<Inventory2Outlined sx={{ fontSize: 16, color: 'text.secondary' }} />}
          primary={item.nombre || 'Sin nombre'}
          secondary={getInventarioRowSecondary(item)}
          trailing={item.cantidad != null ? `× ${item.cantidad}` : ''}
          onClick={onRowClick ? (e) => onRowClick(e, item) : undefined}
        />
      )}
    />
  );
}
