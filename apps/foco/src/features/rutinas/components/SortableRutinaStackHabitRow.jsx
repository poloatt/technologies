import React from 'react';
import { Box } from '@mui/material';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getRutinaStackSortableId } from '@shared/habits';
import RutinaStackHabitRow from './RutinaStackHabitRow';

/** Fila apilada sorteable: la rutina se mueve como un solo bloque. */
export default function SortableRutinaStackHabitRow({
  chainId,
  ...rowProps
}) {
  const sortId = getRutinaStackSortableId(chainId);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: sortId });

  const { setNodeRef: setDropRef } = useDroppable({ id: sortId });

  const setNodeRef = (node) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.88 : 1,
    zIndex: isDragging ? 2 : 'auto',
    position: 'relative',
  };

  return (
    <Box ref={setNodeRef} style={style}>
      <RutinaStackHabitRow
        chainId={chainId}
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
        {...rowProps}
      />
    </Box>
  );
}
