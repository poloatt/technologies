import React, { memo, useMemo } from 'react';
import { ListItem, Box, Typography, Chip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import HabitIconButton from '@shared/components/habits/HabitIconButton';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { useRutinas } from '@shared/context';
import { useResponsive, useHabitItemContextMenu } from '@shared/hooks';
import {
  isHabitHorarioCompleted,
  formatHabitCadenceProgressLabel,
  resolveHabitCompletadosEnPeriodo,
  canPostponeHabitFranja,
  resolvePostponeTargetFranja,
  getPostponeMenuLabel,
  isEntryGroupedRoutineChain,
  resolveRoutineDisplayName,
} from '@shared/habits';
import HabitItemPostponeMenu from '@shared/components/habits/HabitItemPostponeMenu';
import { HABIT_PERIODIC_COPY } from '@shared/copy/agendaTerminology';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaChecklistLabelSx,
  rutinaChecklistMetaSx,
  rutinaRoutineChipSx,
  rutinaChecklistStackCellItemSx,
  rutinaChecklistStackCellRowSx,
  rutinaChecklistStackCellContentSx,
  rutinaChecklistStackCellTextSx,
  rutinaChecklistIconColumnSx,
  getRutinaChecklistDragHandleSlotSx,
} from '@shared/styles/rutinaPageStyles';
import { getRutinaDragHandleGlyph, getRutinaHabitIconTokens } from '@shared/styles/rutinaIconTokens';

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
}) => {
  const { rutina } = useRutinas();
  const { isMobileOrTablet } = useResponsive();
  const { menuState, closeMenu, getRowHandlers } = useHabitItemContextMenu({
    enabled: allowPostpone && !readOnly,
  });

  const isHorarioCompleted = (horario) => {
    const itemValue = localData?.[itemId] !== undefined
      ? localData[itemId]
      : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);
    return isHabitHorarioCompleted(itemValue, horario);
  };

  const secondaryText = useMemo(() => {
    if (!config) return '';
    if (isCadenciaDebt) return HABIT_PERIODIC_COPY.cadenciaDebt;

    const completados = resolveHabitCompletadosEnPeriodo({
      itemId,
      section,
      rutina,
      config,
      isCompleted,
    });
    const baseLabel = formatHabitCadenceProgressLabel(config, completados);
    const tipo = (config.tipo || 'DIARIO').toUpperCase();
    const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && config?.periodo === 'CADA_DIA');

    if (!isDaily && isScheduled) {
      return `Hoy · ${baseLabel}`;
    }

    return baseLabel;
  }, [config, isCompleted, rutina, section, itemId, isCadenciaDebt, isScheduled]);

  const showRoutineMeta = isEntryGroupedRoutineChain(chain) && !isCadenciaDebt;
  const routineChipLabel = showRoutineMeta ? resolveRoutineDisplayName(chain) : '';
  const showMetaRow = Boolean(config) && (!hideMeta || showRoutineMeta);

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

  const iconTokens = getRutinaHabitIconTokens({
    mobile: isMobileOrTablet,
    compact: iconColumnCompact,
    stackCell,
  });
  const iconSize = iconTokens.size;
  const iconGlyph = iconTokens.glyph;

  const itemValue = localData?.[itemId] !== undefined
    ? localData[itemId]
    : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);

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
  const postponeRowHandlers = getRowHandlers(postponeEntry, {
    canPostpone,
    postponeLabel,
    franja: postponeFranja,
  });

  const renderHabitActionButtons = () => {
    if (readOnly) return null;

    if (normalizedFocusHorario && normalizedFocusHorario !== 'GENERAL') {
      const franjaCompleted = isHorarioCompleted(normalizedFocusHorario);
      return (
        <HabitIconButton
          isCompleted={franjaCompleted}
          Icon={Icon}
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
            ...(canPostpone
              ? {
                cursor: 'context-menu',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                touchAction: 'manipulation',
              }
              : null),
          }}
          {...(canPostpone ? postponeRowHandlers : {})}
        >
          <Box sx={rutinaChecklistIconColumnSx({ compact: iconColumnCompact, mobile: isMobileOrTablet })}>
            {habitActionButtons}
          </Box>
          <Box
            sx={{
              ...rutinaChecklistTextColumnSx,
              ...(stackCell ? rutinaChecklistStackCellTextSx : null),
            }}
          >
            <Typography
              variant="body2"
              sx={{
                ...rutinaChecklistLabelSx(isCompleted),
                ...(stackCell ? { whiteSpace: 'normal', textAlign: 'left', fontSize: '0.8125rem', width: '100%' } : null),
              }}
            >
              {habitLabel || itemId}
            </Typography>
            {showMetaRow && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 0.5,
                mt: stackCell ? 0.1 : 0.2,
                flexWrap: 'wrap',
                width: '100%',
              }}
              >
                {showRoutineMeta ? (
                  <Chip
                    size="small"
                    label={routineChipLabel}
                    sx={rutinaRoutineChipSx}
                  />
                ) : (
                  <Typography
                    variant="caption"
                    sx={{
                      ...rutinaChecklistMetaSx,
                      ...(stackCell ? { whiteSpace: 'normal', textAlign: 'left' } : null),
                    }}
                  >
                    {secondaryText}
                  </Typography>
                )}
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
    prevProps.allowPostpone === nextProps.allowPostpone &&
    prevProps.chain?.id === nextProps.chain?.id &&
    prevProps.chain?.label === nextProps.chain?.label &&
    prevProps.chain?.stepCount === nextProps.chain?.stepCount
  );
});
