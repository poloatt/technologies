import React, { memo, useMemo } from 'react';
import { ListItem, Box, Typography, Chip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import HabitIconButton from '@shared/components/habits/HabitIconButton';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { useRutinas } from '@shared/context';
import { useResponsive, useHabitItemContextMenu } from '@shared/hooks';
import {
  isHabitHorarioCompleted,
  canPostponeHabitFranja,
  resolvePostponeTargetFranja,
  getPostponeMenuLabel,
  isEntryGroupedRoutineChain,
  resolveRoutineDisplayName,
  resolveHistoricalDoneFranjaBadges,
} from '@shared/habits';
import HabitItemPostponeMenu from '@shared/components/habits/HabitItemPostponeMenu';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaChecklistLabelSx,
  rutinaChecklistMetaSx,
  rutinaRoutineChipPrimarySx,
  rutinaChecklistStackCellItemSx,
  rutinaChecklistStackCellRowSx,
  rutinaChecklistStackCellContentSx,
  rutinaChecklistStackCellTextSx,
  rutinaChecklistIconColumnSx,
  getRutinaChecklistDragHandleSlotSx,
} from '@shared/styles/rutinaPageStyles';
import { getHabitIconTokens } from '@shared/styles/habitIconStyles';
import { getRutinaDragHandleGlyph } from '@shared/styles/rutinaIconTokens';

const postponeTextColumnSx = {
  cursor: 'context-menu',
  WebkitTouchCallout: 'none',
  userSelect: 'none',
  touchAction: 'manipulation',
};

const habitIconColumnGuardHandlers = {
  onPointerDown: (event) => event.stopPropagation(),
  onContextMenu: (event) => event.stopPropagation(),
};

export { default as HabitIconButton } from '@shared/components/habits/HabitIconButton';

const ChecklistItem = ({
  itemId,
  section,
  Icon,
  isCompleted,
  readOnly,
  onItemClick,
  config = {},
  habitLabel = '',
  localData = null,
  completionValue = undefined,
  dragHandleAttributes = null,
  dragHandleListeners = null,
  focusHorario = null,
  stackCell = false,
  hideMeta = false,
  iconColumnCompact = false,
  isCadenciaDebt = false,
  isScheduled = true,
  chain = null,
  allowPostpone = false,
  onPostpone,
  hideIconBorder = false,
  deferredPending = false,
  quotaSlot = null,
  rutina: rutinaProp = null,
}) => {
  const { rutina: contextRutina } = useRutinas();
  const rutina = rutinaProp ?? contextRutina;
  const { isMobileOrTablet } = useResponsive();
  const { menuState, closeMenu, getTextColumnHandlers } = useHabitItemContextMenu({
    enabled: allowPostpone && !readOnly,
  });

  const isHorarioCompleted = (horario) => {
    const itemValue = localData?.[itemId] !== undefined
      ? localData[itemId]
      : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);
    return isHabitHorarioCompleted(itemValue, horario);
  };

  const hasRoutine = isEntryGroupedRoutineChain(chain) && !isCadenciaDebt;
  const primaryText = hasRoutine
    ? resolveRoutineDisplayName(chain)
    : HABIT_CHAIN_COPY.noRoutine;
  const secondaryText = habitLabel || itemId;
  const showMetaRow = !hideMeta;

  const horariosConfig = useMemo(
    () => normalizeTimeOfDay(config?.horarios),
    [config?.horarios],
  );
  const normalizedFocusHorario = focusHorario
    ? String(focusHorario).toUpperCase()
    : null;
  const hasMultipleFranjas = horariosConfig.length > 1 && !normalizedFocusHorario;
  const singleDisplayHorario = normalizedFocusHorario
    || (horariosConfig.length === 1 ? String(horariosConfig[0]).toUpperCase() : null);
  const isHistoricalDay = rutina?.fecha && getRutinaDayMode(rutina.fecha) === 'historical';

  const iconTokens = getHabitIconTokens({
    mobile: isMobileOrTablet,
    compact: iconColumnCompact,
    stackCell,
  });
  const iconSize = iconTokens.size;
  const iconGlyph = iconTokens.glyph;

  const itemValue = localData?.[itemId] !== undefined
    ? localData[itemId]
    : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);

  const completedFranjaBadges = (isHistoricalDay && isCompleted)
    ? resolveHistoricalDoneFranjaBadges({
      rutina,
      config,
      itemValue,
      franjaKey: normalizedFocusHorario,
    })
    : null;

  const postponeFranja = normalizedFocusHorario || singleDisplayHorario || getCurrentTimeOfDay();
  const nextPostponeFranja = resolvePostponeTargetFranja({
    config,
    itemValue,
    focusHorario: postponeFranja,
    currentTimeOfDay: getCurrentTimeOfDay(),
  });
  const postponeLabel = getPostponeMenuLabel(nextPostponeFranja);
  const canPostpone = canPostponeHabitFranja({
    rutina,
    section,
    itemId,
    config,
    itemValue,
    focusHorario: postponeFranja,
    currentTimeOfDay: getCurrentTimeOfDay(),
    readOnly,
    allowPostpone,
  });
  const postponeEntry = { section, itemId, config, itemValue, label: habitLabel || itemId };
  const postponeTextHandlers = getTextColumnHandlers(postponeEntry, {
    canPostpone,
    postponeLabel,
    franja: postponeFranja,
  });

  const renderHabitActionButtons = () => {
    if (normalizedFocusHorario && normalizedFocusHorario !== 'GENERAL') {
      const franjaCompleted = isHorarioCompleted(normalizedFocusHorario);
      return (
        <HabitIconButton
          isCompleted={franjaCompleted}
          Icon={Icon}
          hideBorder={hideIconBorder}
          deferredPending={deferredPending}
          quotaSlot={quotaSlot}
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) onItemClick(itemId, e, normalizedFocusHorario);
          }}
          config={config}
          currentTimeOfDay={getCurrentTimeOfDay()}
          displayHorario={normalizedFocusHorario}
          rutina={rutina}
          section={section}
          itemId={itemId}
          readOnly={readOnly}
          size={iconSize}
          glyph={iconGlyph}
          mr={0}
        />
      );
    }

    if (hasMultipleFranjas) {
      if (completedFranjaBadges?.length) {
        return (
          <HabitIconButton
            isCompleted={isCompleted}
            Icon={Icon}
            hideBorder={hideIconBorder}
            deferredPending={deferredPending}
            quotaSlot={quotaSlot}
            onClick={(e) => {
              e.stopPropagation();
              if (!readOnly) onItemClick(itemId, e, singleDisplayHorario);
            }}
            readOnly={readOnly}
            config={config}
            currentTimeOfDay={getCurrentTimeOfDay()}
            completedHorarios={completedFranjaBadges}
            rutina={rutina}
            section={section}
            itemId={itemId}
            size={iconSize}
            glyph={iconGlyph}
            mr={0}
          />
        );
      }

      return (
        <HabitIconScrollRow
          itemCount={horariosConfig.length}
          iconSize={iconSize}
          sx={{ mr: 0, flexShrink: 0 }}
        >
          {(guardClick) => horariosConfig.map((horario) => {
            const normalizedHorario = String(horario).toUpperCase();
            const franjaCompleted = isHorarioCompleted(normalizedHorario);
            return (
              <HabitIconButton
                key={normalizedHorario}
                isCompleted={franjaCompleted}
                Icon={Icon}
                hideBorder={hideIconBorder}
                deferredPending={deferredPending}
                quotaSlot={quotaSlot}
                onClick={(e) => {
                  if (guardClick()) {
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  if (!readOnly) onItemClick(itemId, e, normalizedHorario);
                }}
                readOnly={readOnly}
                config={config}
                currentTimeOfDay={getCurrentTimeOfDay()}
                displayHorario={normalizedHorario}
                rutina={rutina}
                section={section}
                itemId={itemId}
                size={iconSize}
                glyph={iconGlyph}
                mr={0}
              />
            );
          })}
        </HabitIconScrollRow>
      );
    }

    return (
      <HabitIconButton
        isCompleted={isCompleted}
        Icon={Icon}
        hideBorder={hideIconBorder}
        deferredPending={deferredPending}
        quotaSlot={quotaSlot}
        onClick={(e) => {
          e.stopPropagation();
          if (!readOnly) onItemClick(itemId, e, singleDisplayHorario);
        }}
        readOnly={readOnly}
        config={config}
        currentTimeOfDay={getCurrentTimeOfDay()}
        displayHorario={singleDisplayHorario}
        rutina={rutina}
        section={section}
        itemId={itemId}
        size={iconSize}
        glyph={iconGlyph}
        mr={0}
      />
    );
  };

  const habitActionButtons = renderHabitActionButtons();

  return (
    <ListItem
      disablePadding
      sx={{
        ...rutinaChecklistItemSx,
        ...(stackCell ? rutinaChecklistStackCellItemSx : null),
      }}
    >
      <Box sx={{ ...rutinaChecklistRowSx, ...(stackCell ? rutinaChecklistStackCellRowSx : null) }}>
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
              sx={{ display: 'flex', alignItems: 'center' }}
              aria-label={`Reordenar ${habitLabel || itemId}`}
            >
              <DragIndicatorIcon sx={{ fontSize: getRutinaDragHandleGlyph(isMobileOrTablet) }} />
            </Box>
          ) : null}
        </Box>
        <Box
          sx={{
            ...rutinaChecklistContentSx,
            ...(stackCell ? rutinaChecklistStackCellContentSx : null),
          }}
        >
          <Box
            sx={rutinaChecklistIconColumnSx({ compact: iconColumnCompact, mobile: isMobileOrTablet })}
            {...habitIconColumnGuardHandlers}
          >
            {habitActionButtons}
          </Box>
          <Box
            sx={{
              ...rutinaChecklistTextColumnSx,
              ...(stackCell ? rutinaChecklistStackCellTextSx : null),
              ...(canPostpone ? postponeTextColumnSx : null),
            }}
            {...(canPostpone ? postponeTextHandlers : {})}
          >
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              width: '100%',
            }}
            >
              {hasRoutine ? (
                <Chip
                  size="small"
                  label={primaryText}
                  sx={{
                    ...rutinaRoutineChipPrimarySx,
                    ...(isCompleted ? {
                      opacity: 0.55,
                      '& .MuiChip-label': { textDecoration: 'line-through' },
                    } : null),
                  }}
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    ...rutinaChecklistLabelSx(isCompleted),
                    ...(stackCell ? { whiteSpace: 'normal', textAlign: 'right', fontSize: '0.8125rem', width: '100%' } : null),
                  }}
                >
                  {primaryText}
                </Typography>
              )}
            </Box>
            {showMetaRow && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 0.5,
                mt: stackCell ? 0.1 : 0.2,
                flexWrap: 'wrap',
                width: '100%',
              }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    ...rutinaChecklistMetaSx,
                    ...(stackCell ? { whiteSpace: 'normal', textAlign: 'left' } : null),
                  }}
                >
                  {secondaryText}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      {(allowPostpone && !readOnly) && (
        <HabitItemPostponeMenu
          open={menuState.open && menuState.entry?.itemId === itemId && menuState.entry?.section === section}
          anchorPosition={menuState.anchorPosition}
          postponeLabel={menuState.postponeLabel}
          onClose={closeMenu}
          onPostpone={() => onPostpone?.(section, itemId, menuState.franja || postponeFranja)}
        />
      )}
    </ListItem>
  );
};

export default memo(ChecklistItem, (prevProps, nextProps) => {
  const prevHorarios = JSON.stringify(prevProps.config?.horarios || []);
  const nextHorarios = JSON.stringify(nextProps.config?.horarios || []);
  const prevCompletion = JSON.stringify(
    prevProps.localData?.[prevProps.itemId] ?? prevProps.completionValue ?? null,
  );
  const nextCompletion = JSON.stringify(
    nextProps.localData?.[nextProps.itemId] ?? nextProps.completionValue ?? null,
  );

  return (
    prevProps.itemId === nextProps.itemId &&
    prevProps.section === nextProps.section &&
    prevProps.isCompleted === nextProps.isCompleted &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.config?.tipo === nextProps.config?.tipo &&
    prevProps.config?.frecuencia === nextProps.config?.frecuencia &&
    prevProps.config?.activo === nextProps.config?.activo &&
    prevHorarios === nextHorarios &&
    prevCompletion === nextCompletion &&
    prevProps.focusHorario === nextProps.focusHorario &&
    prevProps.stackCell === nextProps.stackCell &&
    prevProps.hideMeta === nextProps.hideMeta &&
    prevProps.iconColumnCompact === nextProps.iconColumnCompact &&
    prevProps.isCadenciaDebt === nextProps.isCadenciaDebt &&
    prevProps.isScheduled === nextProps.isScheduled &&
    prevProps.hideIconBorder === nextProps.hideIconBorder &&
    prevProps.deferredPending === nextProps.deferredPending &&
    prevProps.quotaSlot === nextProps.quotaSlot &&
    prevProps.allowPostpone === nextProps.allowPostpone &&
    prevProps.habitLabel === nextProps.habitLabel &&
    prevProps.chain?.id === nextProps.chain?.id &&
    prevProps.chain?.label === nextProps.chain?.label &&
    prevProps.chain?.stepCount === nextProps.chain?.stepCount &&
    prevProps.onItemClick === nextProps.onItemClick &&
    prevProps.onPostpone === nextProps.onPostpone &&
    prevProps.rutina?._id === nextProps.rutina?._id &&
    prevProps.rutina?.fecha === nextProps.rutina?.fecha &&
    Boolean(prevProps.rutina?.isPreview) === Boolean(nextProps.rutina?.isPreview)
  );
});
