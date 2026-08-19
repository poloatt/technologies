import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { DragIndicatorOutlined as DragIcon } from '@mui/icons-material';
import { monedaCarouselSx } from './monedaConstants';
import { arrayMove, getMonedaId, sortMonedasByOrden } from './monedaSortUtils';

/**
 * Lista de monedas reordenable por drag-and-drop (asa de arrastre).
 */
export default function MonedasSortableList({
  monedas,
  onReorder,
  renderTile,
  layout = 'carousel',
}) {
  const [items, setItems] = useState(() => sortMonedasByOrden(monedas));
  const dragFrom = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(sortMonedasByOrden(monedas));
  }, [monedas]);

  const applyReorder = async (nextItems) => {
    const prev = items;
    setItems(nextItems);
    setIsSaving(true);
    try {
      await onReorder(nextItems.map(getMonedaId));
    } catch (err) {
      setItems(prev);
      throw err;
    } finally {
      setIsSaving(false);
      setDragOverIndex(null);
      dragFrom.current = null;
    }
  };

  const handleDrop = (toIndex) => {
    const fromIndex = dragFrom.current;
    dragFrom.current = null;
    setDragOverIndex(null);
    if (fromIndex == null || fromIndex === toIndex) return;
    applyReorder(arrayMove(items, fromIndex, toIndex));
  };

  const isColumn = layout === 'column';
  const containerSx = isColumn
    ? { display: 'flex', flexDirection: 'column', gap: 0.625, width: '100%' }
    : monedaCarouselSx;

  return (
    <Box sx={{ ...containerSx, opacity: isSaving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      {items.map((moneda, index) => {
        const id = getMonedaId(moneda);
        const isDragTarget = dragOverIndex === index && dragFrom.current !== index;

        return (
          <Box
            key={id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragFrom.current !== null && dragFrom.current !== index) {
                setDragOverIndex(index);
              }
            }}
            onDragLeave={() => {
              setDragOverIndex((current) => (current === index ? null : current));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(index);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              width: isColumn ? '100%' : undefined,
              flex: isColumn ? '1 1 auto' : undefined,
              borderRadius: 1.5,
              outline: isDragTarget ? '2px dashed' : 'none',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            }}
          >
            <Box
              draggable={!isSaving}
              onDragStart={(e) => {
                dragFrom.current = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragOverIndex(null);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                alignSelf: 'stretch',
                px: 0.25,
                cursor: isSaving ? 'default' : 'grab',
                color: 'text.disabled',
                '&:active': { cursor: isSaving ? 'default' : 'grabbing' },
              }}
            >
              <DragIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>{renderTile(moneda)}</Box>
          </Box>
        );
      })}
    </Box>
  );
}
