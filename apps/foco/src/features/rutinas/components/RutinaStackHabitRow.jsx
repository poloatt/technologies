import React, { useMemo } from 'react';
import { Box, ListItem } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import {
  isHabitMarkedCompleteForConfig,
  isHabitHorarioCompleted,
  resolveEntryFranjaFocusHorario,
  resolveRoutineDisplayName,
  resolveActiveDailyFranja,
  isEntryFranjaSinHacer,
  resolveDoneFranjaBadges,
  resolveHabitDeferralMenuOptions,
  canDeferHabit,
  HABIT_DEFERRAL_ACTION,
  isHabitHiddenByDeferral,
} from '@shared/habits';
import { useRutinas } from '@shared/context';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistIconColumnSx,
  getRutinaChecklistDragHandleSlotSx,
  rutinaRoutineGroupShellSx,
  rutinaRoutineGroupBodySx,
} from '@shared/styles/rutinaPageStyles';
import { HubSectionHeader } from '@shared/components/hub';
import { getHabitIconTokens } from '@shared/styles/habitIconStyles';
import { getRutinaDragHandleGlyph } from '@shared/styles/rutinaIconTokens';
import { useResponsive, useHabitItemContextMenu } from '@shared/hooks';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import HabitItemPostponeMenu from '@shared/components/habits/HabitItemPostponeMenu';
import { HabitIconButton } from './ChecklistItem';
import { resolveEntryLocalData, resolveEntrySection } from '../lib/resolveEntryLocalData';

const DRAG_HANDLE_INNER_SX = {
  display: 'flex',
  alignItems: 'center',
};

function resolveEntryFocusHorario(entry) {
  return resolveEntryFranjaFocusHorario(entry);
}

/** Key estable por hábito + franja (evita ghosts al togglear slots históricos). */
function resolveEntryRenderKey(entry, fallbackSection, prefix = '') {
  const entrySection = resolveEntrySection(entry, fallbackSection);
  const franja = entry?.franjaKey && entry.franjaKey !== 'GENERAL'
    ? entry.franjaKey
    : (entry?.franjaScheduleSlot || 'full');
  const base = `${entrySection}-${entry.itemId}-${franja}`;
  return prefix ? `${prefix}-${base}` : base;
}

function entryHasMultipleFranjas(entry) {
  const horariosConfig = normalizeTimeOfDay(entry.config?.horarios);
  const focusHorario = resolveEntryFranjaFocusHorario(entry);
  return horariosConfig.length > 1 && !focusHorario;
}

/** Fila de rutina: barra de título fina + carousel de hábitos. */
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
  /** Barra de título de rutina (Ahora). Luego/Hecho: solo iconos. */
  showTitleBar = true,
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
      : isHabitMarkedCompleteForConfig(entry.config, itemValue);
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
      Icon: entry.Icon || null,
      chain: entry.chain || null,
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
    const horariosConfig = normalizeTimeOfDay(config?.horarios);
    const normalizedFocusHorario = focusHorario
      ? String(focusHorario).toUpperCase()
      : null;
    const hasMultipleFranjas = horariosConfig.length > 1 && !normalizedFocusHorario;
    const singleDisplayHorario = normalizedFocusHorario
      || (horariosConfig.length === 1 ? String(horariosConfig[0]).toUpperCase() : null);
    const isHistoricalDay = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';
    const isDoneSectionRow = rowKeyPrefix === 'done';
    const shouldShowDoneFranjaBadges = isDoneSectionRow || isHistoricalDay;
    const isCompleted = focusHorario
      ? isHabitHorarioCompleted(itemValue, focusHorario)
      : isHabitMarkedCompleteForConfig(config, itemValue);
    const completedFranjaBadges = (
      shouldShowDoneFranjaBadges
      && isCompleted
      && isDoneSectionRow
      && !normalizedFocusHorario
    )
      ? resolveDoneFranjaBadges({
        config,
        itemValue,
        franjaKey: null,
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
            key={resolveEntryRenderKey(entry, section)}
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
          key={resolveEntryRenderKey(entry, section)}
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
        key={resolveEntryRenderKey(entry, section)}
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
            ...getRutinaChecklistDragHandleSlotSx(isMobileOrTablet, {
              visible: Boolean(dragHandleListeners),
            }),
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
        {showTitleBar ? (
          <Box
            sx={{
              ...rutinaRoutineGroupShellSx,
              ...(allCompleted ? { opacity: 0.72 } : null),
            }}
          >
            <HubSectionHeader
              title={routineName}
              titleSx={allCompleted ? { textDecoration: 'line-through' } : undefined}
            />
            <Box sx={rutinaRoutineGroupBodySx}>
              <Box sx={rutinaChecklistIconColumnSx({
                compact: isCompact,
                mobile: isMobileOrTablet,
                fluid: useFluidIconColumn,
              })}
              >
                {iconColumnContent}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              minWidth: 0,
              flex: '1 1 auto',
              ...(allCompleted ? { opacity: 0.72 } : null),
            }}
            aria-label={routineName}
          >
            <Box sx={rutinaChecklistIconColumnSx({
              compact: isCompact,
              mobile: isMobileOrTablet,
              fluid: useFluidIconColumn,
            })}
            >
              {iconColumnContent}
            </Box>
          </Box>
        )}
      </Box>
      {(allowPostpone && !readOnly) && (
        <HabitItemPostponeMenu
          open={Boolean(menuState.open && menuState.entry)}
          anchorPosition={menuState.anchorPosition}
          postponeLabel={menuState.postponeLabel}
          empujarLabel={menuState.empujarLabel}
          showActions={menuState.canDefer !== false}
          onClose={closeMenu}
          habitLabel={menuState.entry?.label || menuState.entry?.itemId}
          Icon={menuState.entry?.Icon || null}
          config={menuState.entry?.config || null}
          rutina={rutina}
          section={menuState.entry?.section || section}
          itemId={menuState.entry?.itemId || null}
          itemValue={menuState.entry?.itemValue}
          chain={menuState.entry?.chain || entries[0]?.chain}
          routineName={routineName}
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
