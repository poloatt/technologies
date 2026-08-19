import { useMemo, useState } from 'react';

/** Preview expandible para listas en tarjetas hub. */
export function useHubPreviewSlice(items, previewCount = 3) {
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(
    () => items.slice(0, previewCount),
    [items, previewCount],
  );
  const rest = useMemo(
    () => items.slice(previewCount),
    [items, previewCount],
  );
  const hasMore = rest.length > 0;

  return {
    expanded,
    setExpanded,
    preview,
    rest,
    hasMore,
  };
}
