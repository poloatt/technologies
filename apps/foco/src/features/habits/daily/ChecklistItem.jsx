import React, { memo, useMemo } from 'react';
import { ListItem, Box, Typography, Chip, Tooltip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay, normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';
import HabitIconButton from '@shared/components/habits/HabitIconButton';
import HabitIconScrollRow from '@shared/components/habits/HabitIconScrollRow';
import { useRutinas } from '@shared/context';
import { isHabitHorarioCompleted } from '@shared/habits';
import { contarCompletadosEnPeriodo, obtenerHistorialCompletados } from '@shared/habits';
import { parseAPIDate, toISODateString } from '@shared/utils/dateUtils';
import {
  rutinaChecklistItemSx,
  rutinaChecklistRowSx,
  rutinaChecklistContentSx,
  rutinaChecklistTextColumnSx,
  rutinaChecklistLabelSx,
  rutinaChecklistMetaSx,
  rutinaChainLockedRowSx,
  rutinaChainChipSx,
  rutinaChecklistStackCellItemSx,
  rutinaChecklistStackCellRowSx,
  rutinaChecklistStackCellContentSx,
  rutinaChecklistStackCellTextSx,
} from '@shared/styles/rutinaPageStyles';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';

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
  chain = null,
  prevStepLabel = '',
  stackCell = false,
  hideChainBadge = false,
  hideMeta = false,
}) => {
  const { rutina } = useRutinas();

  const isChainLocked = Boolean(chain?.isLocked);
  const effectiveReadOnly = readOnly || isChainLocked;
  const lockedTitle = isChainLocked && prevStepLabel
    ? HABIT_CHAIN_COPY.lockedTooltip(prevStepLabel)
    : undefined;

  const isHorarioCompleted = (horario) => {
    const itemValue = localData?.[itemId] !== undefined
      ? localData[itemId]
      : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);
    return isHabitHorarioCompleted(itemValue, horario);
  };

  const secondaryText = useMemo(() => {
    if (!config) return '';

    const tipo = (config?.tipo || 'DIARIO').toUpperCase();
    const frecuencia = Number(config?.frecuencia || 1);
    const periodo = config?.periodo ? config.periodo.toUpperCase() : 'CADA_DIA';

    let completados = 0;

    if (tipo === 'DIARIO') {
      const horariosConfig = Array.isArray(config.horarios) ? config.horarios : [];
      if (horariosConfig.length > 0) {
        return frecuencia === 1 ? 'Diario' : `${frecuencia}x/día`;
      }

      const itemValue = rutina?.[section]?.[itemId];
      const isObjectFormat = typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue);

      if (horariosConfig.length > 1 && isObjectFormat) {
        completados = Object.values(itemValue).filter(Boolean).length;
      } else {
        completados = isCompleted ? 1 : 0;
      }
    } else if (tipo === 'SEMANAL' || tipo === 'MENSUAL' ||
               (tipo === 'PERSONALIZADO' && periodo !== 'CADA_DIA')) {
      if (rutina) {
        const historial = obtenerHistorialCompletados(itemId, section, rutina);
        const refDate = rutina.fecha ? parseAPIDate(rutina.fecha) : new Date();
        completados = contarCompletadosEnPeriodo(refDate, tipo, periodo, historial);

        if (isCompleted) {
          const refStr = toISODateString(refDate);
          const yaEstaEnHistorial = historial.some((fecha) => {
            try {
              return toISODateString(fecha) === refStr;
            } catch {
              return false;
            }
          });

          if (!yaEstaEnHistorial) {
            completados++;
          }
        }
      } else {
        completados = isCompleted ? 1 : 0;
      }
    } else {
      completados = isCompleted ? 1 : 0;
    }

    let label = '';
    switch (tipo) {
      case 'DIARIO':
        label = frecuencia === 1 ? 'Diario' : `${frecuencia}x/día`;
        break;
      case 'SEMANAL':
        label = frecuencia === 1 ? 'Semanal' : `${frecuencia}x/sem`;
        break;
      case 'MENSUAL':
        label = frecuencia === 1 ? 'Mensual' : `${frecuencia}x/mes`;
        break;
      case 'PERSONALIZADO':
        if (periodo === 'CADA_DIA') label = `Cada ${frecuencia}d`;
        else if (periodo === 'CADA_SEMANA') label = `Cada ${frecuencia}s`;
        else if (periodo === 'CADA_MES') label = `Cada ${frecuencia}m`;
        else label = 'Personalizado';
        break;
      default:
        label = 'Diario';
    }

    const horariosConfig = Array.isArray(config?.horarios) ? config.horarios : [];
    if (tipo === 'DIARIO' && horariosConfig.length > 0) {
      return label;
    }
    if (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA') {
      return label;
    }

    return `${label} • ${completados}/${frecuencia}`;
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

  const renderHabitActionButtons = () => {
    if (readOnly && !isChainLocked) return null;

    const buttonProps = {
      readOnly: effectiveReadOnly,
      title: lockedTitle,
    };

    if (normalizedFocusHorario && normalizedFocusHorario !== 'GENERAL') {
      const franjaCompleted = isHorarioCompleted(normalizedFocusHorario);
      const button = (
        <HabitIconButton
          isCompleted={franjaCompleted}
          Icon={Icon}
          onClick={(e) => {
            e.stopPropagation();
            if (!effectiveReadOnly) onItemClick(itemId, e, normalizedFocusHorario);
          }}
          config={config}
          currentTimeOfDay={getCurrentTimeOfDay()}
          displayHorario={normalizedFocusHorario}
          rutina={rutina}
          section={section}
          itemId={itemId}
          {...buttonProps}
        />
      );
      return lockedTitle ? <Tooltip title={lockedTitle}>{button}</Tooltip> : button;
    }

    if (hasMultipleFranjas) {
      const iconSize = stackCell ? 32 : 38;
      return (
        <HabitIconScrollRow
          itemCount={horariosConfig.length}
          iconSize={iconSize}
          sx={{ mr: 0.75 }}
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
                  if (!effectiveReadOnly) onItemClick(itemId, e, normalizedHorario);
                }}
                readOnly={effectiveReadOnly}
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

    const button = (
      <HabitIconButton
        isCompleted={isCompleted}
        Icon={Icon}
        onClick={(e) => {
          e.stopPropagation();
          if (!effectiveReadOnly) onItemClick(itemId, e, singleDisplayHorario);
        }}
        readOnly={effectiveReadOnly}
        config={config}
        currentTimeOfDay={getCurrentTimeOfDay()}
        displayHorario={singleDisplayHorario}
        rutina={rutina}
        section={section}
        itemId={itemId}
        size={stackCell ? 32 : undefined}
        mr={stackCell ? 0 : undefined}
        title={lockedTitle}
      />
    );
    return lockedTitle ? <Tooltip title={lockedTitle}><span>{button}</span></Tooltip> : button;
  };

  return (
    <ListItem
      disablePadding
      sx={{
        ...rutinaChecklistItemSx,
        ...(stackCell ? rutinaChecklistStackCellItemSx : null),
        ...(isChainLocked ? rutinaChainLockedRowSx : null),
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
        {renderHabitActionButtons()}
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
              {!stackCell && chain && !hideChainBadge && chain.stepIndex === 0 && chain.stepCount > 1 && (
                <Chip
                  size="small"
                  label={chain.label || HABIT_CHAIN_COPY.stepProgress(chain.stepIndex + 1, chain.stepCount)}
                  sx={rutinaChainChipSx}
                />
              )}
              {!stackCell && chain && !hideChainBadge && chain.stepIndex > 0 && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={HABIT_CHAIN_COPY.stepProgress(chain.stepIndex + 1, chain.stepCount)}
                  sx={rutinaChainChipSx}
                />
              )}
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
    prevProps.hideChainBadge === nextProps.hideChainBadge &&
    prevProps.hideMeta === nextProps.hideMeta &&
    JSON.stringify(prevProps.chain) === JSON.stringify(nextProps.chain)
  );
});
