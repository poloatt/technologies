import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import {
  groupEntriesIntoDisplayRows,
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
} from '@shared/habits';
import ChecklistItem from '../../components/ChecklistItem';
import RutinaStackHabitRow from '../../components/RutinaStackHabitRow';

function resolveEntrySection(entry, fallbackSection) {
  return entry?.section || fallbackSection;
}

function DoneChecklistRow({
  entry,
  rutina,
  readOnly,
  onToggle,
  stackVariant,
}) {
  const entrySection = resolveEntrySection(entry, null);
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  const { itemId, Icon, label, config } = entry;
  const itemValue = rutina?.[entrySection]?.[itemId];
  const isCompleted = focusHorario
    ? isHabitHorarioCompleted(itemValue, focusHorario)
    : isHabitCompletedForHistorial(itemValue);

  const handleItemClick = (clickedItemId, event, horario) => {
    onToggle?.(entrySection, clickedItemId, horario ?? focusHorario ?? null);
  };

  return (
    <Box
      key={`done-${entrySection}-${itemId}-${focusHorario || 'all'}`}
      id={`habit-row-${entrySection}-${itemId}`}
    >
      <ChecklistItem
        itemId={itemId}
        section={entrySection}
        Icon={Icon}
        isCompleted={isCompleted}
        completionValue={itemValue}
        readOnly={readOnly}
        onItemClick={handleItemClick}
        config={config}
        habitLabel={label}
        focusHorario={focusHorario}
        chain={entry.chain}
        iconColumnCompact={stackVariant === 'compact'}
        quotaSlot={entry.quotaSlot ?? null}
        rutina={rutina}
      />
    </Box>
  );
}

/** Detalle expandido de Hecho histórico: rutinas apiladas + hábitos sueltos. */
export default function RutinaDoneDetailRows({
  items = [],
  rutina,
  habits = null,
  readOnly = false,
  onToggle,
  stackVariant = 'inline',
}) {
  const displayRows = useMemo(
    () => groupEntriesIntoDisplayRows(items),
    [items],
  );

  if (!displayRows.length) return null;

  const handleStackClick = (itemId, event, horario, entrySection) => {
    onToggle?.(entrySection, itemId, horario);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      {displayRows.map((row) => {
        if (row.kind === 'stack') {
          return (
            <RutinaStackHabitRow
              key={`done-stack-${row.chainId}`}
              chainId={row.chainId}
              entries={row.entries}
              rutina={rutina}
              habits={habits}
              readOnly={readOnly}
              onItemClick={handleStackClick}
              multiSection
              stackVariant={stackVariant}
              rowKeyPrefix="done"
            />
          );
        }

        return (
          <DoneChecklistRow
            key={`done-${row.entry.section}-${row.entry.itemId}`}
            entry={row.entry}
            rutina={rutina}
            readOnly={readOnly}
            onToggle={onToggle}
            stackVariant={stackVariant}
          />
        );
      })}
    </Box>
  );
}
