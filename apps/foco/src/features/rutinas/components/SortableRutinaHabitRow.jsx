import React from 'react';
import { Box } from '@mui/material';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { isHabitCompletedForHistorial, isHabitHorarioCompleted, resolveEntryFranjaFocusHorario, isEntryFranjaSinHacer, resolveActiveDailyFranja } from '@shared/habits';
import ChecklistItem from './ChecklistItem';

export default function SortableRutinaHabitRow({
  entry,
  section,
  rutina,
  readOnly,
  onItemClick,
  localData,
  multiSection = false,
  stackVariant = 'inline',
  allowPostpone = false,
  onDefer,
  onPostpone,
  deferredPending = false,
}) {
  const { itemId, Icon, label, config } = entry;
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  const itemValue = localData?.[itemId] !== undefined
    ? localData[itemId]
    : rutina?.[section]?.[itemId];
  const isCompleted = focusHorario
    ? isHabitHorarioCompleted(itemValue, focusHorario)
    : isHabitCompletedForHistorial(itemValue);
  const hideIconBorder = isEntryFranjaSinHacer(entry, resolveActiveDailyFranja(rutina));

  const handleItemClick = (clickedItemId, event, horario) => {
    const resolvedHorario = horario ?? focusHorario ?? null;
    if (multiSection) {
      onItemClick(clickedItemId, event, resolvedHorario, section);
      return;
    }
    onItemClick(clickedItemId, event, resolvedHorario);
  };

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: itemId });

  const { setNodeRef: setDropRef } = useDroppable({ id: itemId });

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
    <Box ref={setNodeRef} style={style} id={`habit-row-${itemId}`}>
      <ChecklistItem
        itemId={itemId}
        section={section}
        Icon={Icon}
        isCompleted={isCompleted}
        completionValue={itemValue}
        readOnly={readOnly}
        onItemClick={handleItemClick}
        config={config}
        habitLabel={label}
        localData={localData}
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
        iconColumnCompact={stackVariant === 'compact'}
        isCadenciaDebt={entry.isCadenciaDebt}
        isScheduled={entry.isScheduled}
        chain={entry.chain}
        focusHorario={focusHorario}
        allowPostpone={allowPostpone}
        onDefer={onDefer}
        onPostpone={onPostpone}
        hideIconBorder={hideIconBorder}
        deferredPending={deferredPending}
        quotaSlot={entry.quotaSlot ?? null}
        rutina={rutina}
      />
    </Box>
  );
}
