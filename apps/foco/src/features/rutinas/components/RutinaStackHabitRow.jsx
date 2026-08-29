import React from 'react';
import { Box, Chip, ListItem, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
  resolveRoutineDisplayName,
  ROUTINE_CHIP_LABEL,
} from '@shared/habits';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaChecklistLabelSx,
  rutinaRoutineChipSx,
  rutinaChecklistIconColumnSx,
  getRutinaChecklistDragHandleSlotSx,
} from '@shared/styles/rutinaPageStyles';
import { getRutinaDragHandleGlyph, getRutinaHabitIconTokens } from '@shared/styles/rutinaIconTokens';
import { useResponsive } from '@shared/hooks';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { HabitIconButton } from './ChecklistItem';

const DRAG_HANDLE_INNER_SX = {
  display: 'flex',
  alignItems: 'center',
};

function resolveEntrySection(entry, fallbackSection) {
  return entry?.section || fallbackSection;
}

function resolveEntryLocalData(entry, fallbackSection, localData, localDataBySection) {
  const section = resolveEntrySection(entry, fallbackSection);
  if (localDataBySection && section) {
    return localDataBySection[section] || null;
  }
  return localData;
}

function resolveEntryFocusHorario(entry) {
  return resolveEntryFranjaFocusHorario(entry);
}

/** Fila de rutina: iconos agrupados + nombre + chip "Rutina". */
export default function RutinaStackHabitRow({
  entries = [],
  chainId,
  section,
  rutina,
  readOnly,
  onItemClick,
  localData,
  localDataBySection = null,
  rowKeyPrefix = '',
  multiSection = false,
  stackVariant = 'inline',
  dragHandleAttributes = null,
  dragHandleListeners = null,
}) {
  const { isMobileOrTablet } = useResponsive();
  const isCompact = stackVariant === 'compact';
  const iconTokens = getRutinaHabitIconTokens({ mobile: isMobileOrTablet, compact: isCompact });
  const iconSize = iconTokens.size;
  const iconGlyph = iconTokens.glyph;
  const routineName = resolveRoutineDisplayName(entries[0]?.chain);

  const allCompleted = entries.every((entry) => {
    const entrySection = resolveEntrySection(entry, section);
    const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
    const focusHorario = resolveEntryFocusHorario(entry);
    const itemValue = entryLocalData?.[entry.itemId] !== undefined
      ? entryLocalData[entry.itemId]
      : rutina?.[entrySection]?.[entry.itemId];
    return focusHorario
      ? isHabitHorarioCompleted(itemValue, focusHorario)
      : isHabitCompletedForHistorial(itemValue);
  });

  const renderStackIcon = (entry) => {
    const entrySection = resolveEntrySection(entry, section);
    const { itemId, Icon, config } = entry;
    const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
    const focusHorario = resolveEntryFocusHorario(entry);
    const itemValue = entryLocalData?.[itemId] !== undefined
      ? entryLocalData[itemId]
      : rutina?.[entrySection]?.[itemId];
    const isCompleted = focusHorario
      ? isHabitHorarioCompleted(itemValue, focusHorario)
      : isHabitCompletedForHistorial(itemValue);

    const horariosConfig = normalizeTimeOfDay(config?.horarios);
    const normalizedFocusHorario = focusHorario
      ? String(focusHorario).toUpperCase()
      : null;
    const hasMultipleFranjas = horariosConfig.length > 1 && !normalizedFocusHorario;
    const singleDisplayHorario = normalizedFocusHorario
      || (horariosConfig.length === 1 ? String(horariosConfig[0]).toUpperCase() : null);

    const handleClick = (event, horario) => {
      const resolvedHorario = horario ?? focusHorario ?? null;
      if (multiSection) {
        onItemClick(itemId, event, resolvedHorario, entrySection);
        return;
      }
      onItemClick(itemId, event, resolvedHorario);
    };

    const buttonProps = {
      readOnly,
      config,
      currentTimeOfDay: getCurrentTimeOfDay(),
      rutina,
      section: entrySection,
      itemId,
      size: iconSize,
      glyph: iconGlyph,
      mr: 0,
    };

    if (hasMultipleFranjas) {
      return (
        <HabitIconScrollRow
          key={`${entrySection}-${itemId}`}
          itemCount={horariosConfig.length}
          iconSize={iconSize}
        >
          {(guardClick) => horariosConfig.map((horario) => {
            const normalizedHorario = String(horario).toUpperCase();
            const franjaCompleted = isHabitHorarioCompleted(itemValue, normalizedHorario);
            return (
              <HabitIconButton
                key={normalizedHorario}
                isCompleted={franjaCompleted}
                Icon={Icon}
                onClick={(e) => {
                  if (guardClick()) return;
                  e.stopPropagation();
                  if (!readOnly) handleClick(e, normalizedHorario);
                }}
                displayHorario={normalizedHorario}
                {...buttonProps}
              />
            );
          })}
        </HabitIconScrollRow>
      );
    }

    return (
      <HabitIconButton
        key={`${entrySection}-${itemId}`}
        isCompleted={isCompleted}
        Icon={Icon}
        onClick={(e) => {
          e.stopPropagation();
          if (!readOnly) handleClick(e, singleDisplayHorario);
        }}
        displayHorario={singleDisplayHorario}
        {...buttonProps}
      />
    );
  };

  return (
    <ListItem
      disablePadding
      sx={rutinaChecklistItemSx}
      id={rowKeyPrefix ? `habit-stack-row-${rowKeyPrefix}-${chainId}` : `habit-stack-row-${chainId}`}
      data-habit-stack={chainId}
    >
      <Box sx={rutinaChecklistRowSx}>
        <Box
          sx={{
            ...getRutinaChecklistDragHandleSlotSx(isMobileOrTablet),
            ...(dragHandleListeners ? { cursor: 'grab' } : null),
          }}
        >
          {dragHandleListeners ? (
            <Box
              {...dragHandleAttributes}
              {...dragHandleListeners}
              onClick={(event) => event.stopPropagation()}
              sx={DRAG_HANDLE_INNER_SX}
              aria-label={`Reordenar rutina ${routineName}`}
            >
              <DragIndicatorIcon sx={{ fontSize: getRutinaDragHandleGlyph(isMobileOrTablet) }} />
            </Box>
          ) : null}
        </Box>
        <Box sx={rutinaChecklistContentSx}>
          <Box sx={rutinaChecklistIconColumnSx({ compact: isCompact, mobile: isMobileOrTablet })}>
            {entries.map((entry) => renderStackIcon(entry))}
          </Box>
          <Box sx={{ ...rutinaChecklistTextColumnSx, flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={rutinaChecklistLabelSx(allCompleted)}
            >
              {routineName}
            </Typography>
            <Chip
              size="small"
              label={ROUTINE_CHIP_LABEL}
              sx={rutinaRoutineChipSx}
            />
          </Box>
        </Box>
      </Box>
    </ListItem>
  );
}
