import React, { memo, useMemo } from 'react';
import { ListItem, Box, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import HabitIconButton from '@shared/components/habits/HabitIconButton';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { useRutinas } from '@shared/context';
import { isHabitHorarioCompleted, formatHabitCadenceProgressLabel, resolveHabitCompletadosEnPeriodo } from '@shared/habits';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaChecklistLabelSx,
  rutinaChecklistMetaSx,
  rutinaChecklistStackCellItemSx,
  rutinaChecklistStackCellRowSx,
  rutinaChecklistStackCellContentSx,
  rutinaChecklistStackCellTextSx,
  rutinaChecklistIconColumnSx,
  getRutinaChecklistIconSize,
} from '@shared/styles/rutinaPageStyles';

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
}) => {
  const { rutina } = useRutinas();

  const isHorarioCompleted = (horario) => {
    const itemValue = localData?.[itemId] !== undefined
      ? localData[itemId]
      : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);
    return isHabitHorarioCompleted(itemValue, horario);
  };

  const secondaryText = useMemo(() => {
    if (!config) return '';
    const completados = resolveHabitCompletadosEnPeriodo({
      itemId,
      section,
      rutina,
      config,
      isCompleted,
    });
    return formatHabitCadenceProgressLabel(config, completados);
  }, [config, isCompleted, rutina, section, itemId]);

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

  const iconSize = stackCell ? 32 : getRutinaChecklistIconSize(iconColumnCompact);

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
          mr={0}
        />
      );
    }

    if (hasMultipleFranjas) {
      return (
        <HabitIconScrollRow
          itemCount={horariosConfig.length}
          iconSize={iconSize}
          sx={{ mr: 0, width: '100%', maxWidth: '100%' }}
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
        {dragHandleListeners && (
          <Box
            {...dragHandleAttributes}
            {...dragHandleListeners}
            onClick={(event) => event.stopPropagation()}
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.disabled',
              cursor: 'grab',
              touchAction: 'none',
              flexShrink: 0,
              mr: 0.25,
              '&:active': { cursor: 'grabbing' },
            }}
            aria-label={`Reordenar ${habitLabel || itemId}`}
          >
            <DragIndicatorIcon sx={{ fontSize: 18 }} />
          </Box>
        )}
        {habitActionButtons && (
          stackCell ? habitActionButtons : (
            <Box sx={rutinaChecklistIconColumnSx({ compact: iconColumnCompact })}>
              {habitActionButtons}
            </Box>
          )
        )}
        <Box sx={{
          ...rutinaChecklistContentSx,
          ...(stackCell ? rutinaChecklistStackCellContentSx : null),
        }}
        >
          <Box sx={{
            ...rutinaChecklistTextColumnSx,
            ...(stackCell ? rutinaChecklistStackCellTextSx : null),
          }}
          >
            <Box sx={{
              display: 'flex',
              alignItems: stackCell ? 'center' : 'center',
              justifyContent: stackCell ? 'center' : 'flex-start',
              gap: 0.5,
              flex: 1,
              minWidth: 0,
              width: stackCell ? '100%' : undefined,
              flexDirection: stackCell ? 'column' : 'row',
            }}
            >
              <Typography
                variant="body2"
                sx={{
                  ...rutinaChecklistLabelSx(isCompleted),
                  ...(stackCell ? { whiteSpace: 'normal', textAlign: 'center', fontSize: '0.8125rem' } : null),
                }}
              >
                {habitLabel || itemId}
              </Typography>
            </Box>
            {config && !hideMeta && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: stackCell ? 'center' : 'flex-start',
                gap: 0.5,
                mt: stackCell ? 0.1 : 0.2,
                flexWrap: 'wrap',
                width: stackCell ? '100%' : undefined,
              }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    ...rutinaChecklistMetaSx,
                    ...(stackCell ? { whiteSpace: 'normal', textAlign: 'center' } : null),
                  }}
                >
                  {secondaryText}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
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
    prevProps.iconColumnCompact === nextProps.iconColumnCompact
  );
});
