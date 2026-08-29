import React from 'react';
import { Box, ListItem, Typography, Tooltip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
  getHabitDisplayLabel,
  resolveStackRoutineLabel,
} from '@shared/habits';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaChecklistLabelSx,
} from '@shared/styles/rutinaPageStyles';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { HabitIconButton } from './ChecklistItem';

const DRAG_HANDLE_SX = {
  display: 'flex',
  alignItems: 'center',
  color: 'text.disabled',
  cursor: 'grab',
  touchAction: 'none',
  flexShrink: 0,
  mr: 0.25,
  '&:active': { cursor: 'grabbing' },
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

/** Fila de rutina apilada: handle + iconos + nombre de rutina. */
export default function RutinaStackHabitRow({
  entries = [],
  chainId,
  section,
  rutina,
  habits = null,
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
  const isCompact = stackVariant === 'compact';
  const iconSize = isCompact ? 32 : 38;
  const routineLabel = resolveStackRoutineLabel(entries[0]?.chain);

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
    const { itemId, Icon, config, chain } = entry;
    const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
    const focusHorario = resolveEntryFocusHorario(entry);
    const itemValue = entryLocalData?.[entry.itemId] !== undefined
      ? entryLocalData[entry.itemId]
      : rutina?.[entrySection]?.[entry.itemId];
    const isCompleted = focusHorario
      ? isHabitHorarioCompleted(itemValue, focusHorario)
      : isHabitCompletedForHistorial(itemValue);
    const isChainLocked = Boolean(chain?.isLocked);
    const effectiveReadOnly = readOnly || isChainLocked;
    const prevStepLabel = chain?.prevStep
      ? getHabitDisplayLabel(chain.prevStep.section, chain.prevStep.habitId, habits)
      : '';
    const lockedTitle = isChainLocked && prevStepLabel
      ? HABIT_CHAIN_COPY.lockedTooltip(prevStepLabel)
      : undefined;

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
      readOnly: effectiveReadOnly,
      title: lockedTitle,
      config,
      currentTimeOfDay: getCurrentTimeOfDay(),
      rutina,
      section: entrySection,
      itemId,
      size: iconSize,
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
            const button = (
              <HabitIconButton
                isCompleted={franjaCompleted}
                Icon={Icon}
                onClick={(e) => {
                  if (guardClick()) return;
                  e.stopPropagation();
                  if (!effectiveReadOnly) handleClick(e, normalizedHorario);
                }}
                displayHorario={normalizedHorario}
                {...buttonProps}
              />
            );
            return lockedTitle
              ? <Tooltip key={normalizedHorario} title={lockedTitle}><span>{button}</span></Tooltip>
              : <Box key={normalizedHorario} component="span">{button}</Box>;
          })}
        </HabitIconScrollRow>
      );
    }

    const button = (
      <HabitIconButton
        isCompleted={isCompleted}
        Icon={Icon}
        onClick={(e) => {
          e.stopPropagation();
          if (!effectiveReadOnly) handleClick(e, singleDisplayHorario);
        }}
        displayHorario={singleDisplayHorario}
        {...buttonProps}
      />
    );

    return lockedTitle
      ? <Tooltip key={`${entrySection}-${itemId}`} title={lockedTitle}><span>{button}</span></Tooltip>
      : <Box key={`${entrySection}-${itemId}`} component="span">{button}</Box>;
  };

  return (
    <ListItem
      disablePadding
      sx={rutinaChecklistItemSx}
      id={rowKeyPrefix ? `habit-stack-row-${rowKeyPrefix}-${chainId}` : `habit-stack-row-${chainId}`}
      data-habit-stack={chainId}
    >
      <Box sx={rutinaChecklistRowSx}>
        {dragHandleListeners && (
          <Box
            {...dragHandleAttributes}
            {...dragHandleListeners}
            onClick={(event) => event.stopPropagation()}
            sx={DRAG_HANDLE_SX}
            aria-label={`Reordenar rutina ${routineLabel}`}
          >
            <DragIndicatorIcon sx={{ fontSize: 18 }} />
          </Box>
        )}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: isCompact ? 0.15 : 0.25,
            mr: 0.75,
            minHeight: iconSize,
          }}
        >
          {entries.map((entry) => renderStackIcon(entry))}
        </Box>
        <Box sx={rutinaChecklistContentSx}>
          <Box sx={rutinaChecklistTextColumnSx}>
            <Typography
              variant="body2"
              sx={rutinaChecklistLabelSx(allCompleted)}
            >
              {routineLabel}
            </Typography>
          </Box>
        </Box>
      </Box>
    </ListItem>
  );
}
