import React, { useMemo } from 'react';
import { Box, Chip, ListItem, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
  resolveRoutineDisplayName,
  resolveActiveDailyFranja,
  isEntryFranjaSinHacer,
  resolveRutinaStackScheduleLegend,
  resolveHistoricalDoneFranjaBadges,
  resolveHabitDeferralMenuOptions,
  canDeferHabit,
  HABIT_DEFERRAL_ACTION,
  isHabitHiddenByDeferral,
} from '@shared/habits';
import { useRutinas } from '@shared/context';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaRoutineChipPrimarySx,
  rutinaChecklistMetaSx,
  rutinaChecklistIconColumnSx,
  getRutinaChecklistDragHandleSlotSx,
} from '@shared/styles/rutinaPageStyles';
import { getHabitIconTokens } from '@shared/styles/habitIconStyles';
import { getRutinaDragHandleGlyph } from '@shared/styles/rutinaIconTokens';
import { useResponsive, useHabitItemContextMenu } from '@shared/hooks';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import HabitItemPostponeMenu from '@shared/components/habits/HabitItemPostponeMenu';
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

function entryHasMultipleFranjas(entry) {
  const horariosConfig = normalizeTimeOfDay(entry.config?.horarios);
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  return horariosConfig.length > 1 && !focusHorario;
}

/** Fila de rutina: iconos agrupados + chip con nombre de rutina. */
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
  deferredPending = false,
  allowPostpone = false,
  onDefer = null,
  onPostpone = null,
}) {
  const { rutinas } = useRutinas();
  const { isMobileOrTablet } = useResponsive();
  const { menuState, closeMenu, getPostponeHandlers } = useHabitItemContextMenu({
    enabled: allowPostpone && !readOnly,
  });
  const isCompact = stackVariant === 'compact';
  const iconTokens = getHabitIconTokens({ mobile: isMobileOrTablet, compact: isCompact });
  const iconSize = iconTokens.size;
  const iconGlyph = iconTokens.glyph;
  const routineName = resolveRoutineDisplayName(entries[0]?.chain);
  const scheduleLegend = useMemo(
    () => resolveRutinaStackScheduleLegend(entries, {
      rutina,
      section,
      localData,
      localDataBySection,
    }),
    [entries, rutina, section, localData, localDataBySection],
  );

  const visibleEntries = useMemo(
    () => entries.filter((entry) => {
      const entrySection = resolveEntrySection(entry, section);
      const focusHorario = resolveEntryFocusHorario(entry);
      const horariosConfig = normalizeTimeOfDay(entry.config?.horarios);
      const normalizedFocusHorario = focusHorario
        ? String(focusHorario).toUpperCase()
        : null;
      const singleDisplayHorario = normalizedFocusHorario
        || (horariosConfig.length === 1 ? String(horariosConfig[0]).toUpperCase() : null);
      const postponeFranja = normalizedFocusHorario || singleDisplayHorario || getCurrentTimeOfDay();
      return !isHabitHiddenByDeferral({
        rutina,
        section: entrySection,
        itemId: entry.itemId,
        franja: postponeFranja,
        allRutinas: rutinas,
      });
    }),
    [entries, section, rutina, rutinas],
  );

  const hasNestedFranjaScroll = useMemo(
    () => visibleEntries.some(entryHasMultipleFranjas),
    [visibleEntries],
  );
  const isMultiIconStack = visibleEntries.length >= 2;
  const useStackIconCarousel = isMultiIconStack && !hasNestedFranjaScroll;
  const useFluidIconColumn = isMultiIconStack;

  const allCompleted = visibleEntries.every((entry) => {
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

  if (!visibleEntries.length) return null;

  const buildDeferMenuMeta = (entry, franjaFocus) => {
    const entrySection = resolveEntrySection(entry, section);
    const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
    const itemValue = entryLocalData?.[entry.itemId] !== undefined
      ? entryLocalData[entry.itemId]
      : rutina?.[entrySection]?.[entry.itemId];
    const franja = franjaFocus
      ? String(franjaFocus).toUpperCase()
      : getCurrentTimeOfDay();
    const menuOptions = resolveHabitDeferralMenuOptions({
      rutina,
      section: entrySection,
      itemId: entry.itemId,
      config: entry.config,
      itemValue,
      focusHorario: franja,
      readOnly,
      allowPostpone,
    });
    return {
      ...menuOptions,
      menuOptions,
      franja: menuOptions.franja || franja,
    };
  };

  const buildPostponeHandlersForEntry = (entry, franjaFocus) => {
    const entrySection = resolveEntrySection(entry, section);
    const entryLocalData = resolveEntryLocalData(entry, section, localData, localDataBySection);
    const itemValue = entryLocalData?.[entry.itemId] !== undefined
      ? entryLocalData[entry.itemId]
      : rutina?.[entrySection]?.[entry.itemId];
    const franja = franjaFocus
      ? String(franjaFocus).toUpperCase()
      : getCurrentTimeOfDay();
    if (!canDeferHabit({
      rutina,
      section: entrySection,
      itemId: entry.itemId,
      config: entry.config,
      itemValue,
      focusHorario: franja,
      readOnly,
      allowPostpone,
    })) {
      return null;
    }
    const postponeEntry = {
      section: entrySection,
      itemId: entry.itemId,
      config: entry.config,
      itemValue,
      label: entry.label || entry.itemId,
    };
    return getPostponeHandlers(postponeEntry, () => buildDeferMenuMeta(entry, franjaFocus));
  };

  const renderStackIcon = (entry, guardClick = null) => {
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
    const isHistoricalDay = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';
    const completedFranjaBadges = (isHistoricalDay && isCompleted)
      ? resolveHistoricalDoneFranjaBadges({
        rutina,
        config,
        itemValue,
        franjaKey: normalizedFocusHorario,
      })
      : null;

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
      hideBorder: isEntryFranjaSinHacer(entry, resolveActiveDailyFranja(rutina)),
      deferredPending,
      quotaSlot: entry.quotaSlot ?? null,
    };

    const postponeFranja = normalizedFocusHorario || singleDisplayHorario || getCurrentTimeOfDay();
    const postponeHandlers = buildPostponeHandlersForEntry(entry, postponeFranja);

    if (hasMultipleFranjas) {
      if (completedFranjaBadges?.length) {
        return (
          <HabitIconButton
            key={`${entrySection}-${itemId}`}
            isCompleted={isCompleted}
            Icon={Icon}
            onClick={(e) => {
              if (guardClick?.()) return;
              e.stopPropagation();
              if (!readOnly) handleClick(e, singleDisplayHorario);
            }}
            completedHorarios={completedFranjaBadges}
            postponeHandlers={allowPostpone && !readOnly ? postponeHandlers : null}
            {...buttonProps}
          />
        );
      }

      return (
        <HabitIconScrollRow
          key={`${entrySection}-${itemId}`}
          itemCount={horariosConfig.length}
          iconSize={iconSize}
        >
          {(innerGuardClick) => horariosConfig.map((horario) => {
            const normalizedHorario = String(horario).toUpperCase();
            const franjaCompleted = isHabitHorarioCompleted(itemValue, normalizedHorario);
            const horarioPostponeFranja = normalizedHorario;
            const horarioHandlers = buildPostponeHandlersForEntry(entry, horarioPostponeFranja);
            return (
              <HabitIconButton
                key={normalizedHorario}
                isCompleted={franjaCompleted}
                Icon={Icon}
                onClick={(e) => {
                  if (innerGuardClick()) return;
                  e.stopPropagation();
                  if (!readOnly) handleClick(e, normalizedHorario);
                }}
                displayHorario={normalizedHorario}
                postponeHandlers={allowPostpone && !readOnly ? horarioHandlers : null}
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
          if (guardClick?.()) return;
          e.stopPropagation();
          if (!readOnly) handleClick(e, singleDisplayHorario);
        }}
        displayHorario={singleDisplayHorario}
        postponeHandlers={allowPostpone && !readOnly ? postponeHandlers : null}
        {...buttonProps}
      />
    );
  };

  const iconColumnContent = useStackIconCarousel ? (
    <HabitIconScrollRow
      itemCount={visibleEntries.length}
      iconSize={iconSize}
      sx={{ mr: 0 }}
    >
      {(guardClick) => visibleEntries.map((entry) => renderStackIcon(entry, guardClick))}
    </HabitIconScrollRow>
  ) : (
    visibleEntries.map((entry) => renderStackIcon(entry))
  );

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
          <Box sx={rutinaChecklistIconColumnSx({
            compact: isCompact,
            mobile: isMobileOrTablet,
            fluid: useFluidIconColumn,
          })}
          >
            {iconColumnContent}
          </Box>
          <Box sx={rutinaChecklistTextColumnSx}>
            <Chip
              size="small"
              label={routineName}
              sx={{
                ...rutinaRoutineChipPrimarySx,
                ...(allCompleted ? {
                  opacity: 0.55,
                  '& .MuiChip-label': { textDecoration: 'line-through' },
                } : null),
              }}
            />
            {scheduleLegend ? (
              <Typography variant="caption" sx={rutinaChecklistMetaSx}>
                {scheduleLegend}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </Box>
      {(allowPostpone && !readOnly) && (
        <HabitItemPostponeMenu
          open={Boolean(menuState.open && menuState.entry)}
          anchorPosition={menuState.anchorPosition}
          postponeLabel={menuState.postponeLabel}
          empujarLabel={menuState.empujarLabel}
          onClose={closeMenu}
          onPostpone={() => {
            const entry = menuState.entry;
            if (!entry || !menuState.canPostpone) return;
            const defer = onDefer || onPostpone;
            defer?.(entry.section, entry.itemId, HABIT_DEFERRAL_ACTION.POSTPONE, {
              franja: menuState.franja,
              postponeTargetDate: menuState.menuOptions?.postponeTargetDate,
              pushTargetDate: menuState.menuOptions?.pushTargetDate,
            });
          }}
          onEmpujar={() => {
            const entry = menuState.entry;
            if (!entry || !menuState.canEmpujar) return;
            const defer = onDefer || onPostpone;
            defer?.(entry.section, entry.itemId, HABIT_DEFERRAL_ACTION.PUSH, {
              franja: menuState.franja,
              postponeTargetDate: menuState.menuOptions?.postponeTargetDate,
              pushTargetDate: menuState.menuOptions?.pushTargetDate,
            });
          }}
          onIgnoreToday={() => {
            const entry = menuState.entry;
            if (!entry) return;
            const defer = onDefer || onPostpone;
            defer?.(entry.section, entry.itemId, HABIT_DEFERRAL_ACTION.IGNORE, {
              franja: menuState.franja,
            });
          }}
        />
      )}
    </ListItem>
  );
}
