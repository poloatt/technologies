import React, { memo, useMemo } from 'react';
import { ListItem, Box, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { getCurrentTimeOfDay } from '@shared/utils/timeOfDayUtils';
import { HabitCrudActions } from '@shared/components/common';
import HabitIconButton from '@shared/components/habits/HabitIconButton';
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
  rutinaRowActionsSx,
  rutinaSystemButtonsSx,
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
  isCustomHabit = false,
  habitLabel = '',
  onEditHabit,
  localData = null,
  completionValue = undefined,
  dragHandleAttributes = null,
  dragHandleListeners = null,
  focusHorario = null,
}) => {
  const { rutina } = useRutinas();

  const isHorarioCompleted = (horario) => {
    const itemValue = localData?.[itemId] !== undefined
      ? localData[itemId]
      : (completionValue !== undefined ? completionValue : rutina?.[section]?.[itemId]);
    return isHabitHorarioCompleted(itemValue, horario);
  };

  const habitCrudItemName = habitLabel || itemId;

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

    return `${label} • ${completados}/${frecuencia}`;
  }, [config, isCompleted, rutina, section, itemId]);

  const horariosConfig = Array.isArray(config?.horarios) ? config.horarios : [];
  const normalizedFocusHorario = focusHorario
    ? String(focusHorario).toUpperCase()
    : null;
  const hasMultipleFranjas = horariosConfig.length > 1 && !normalizedFocusHorario;
  const habitPartiallyComplete = hasMultipleFranjas
    && horariosConfig.some((horario) => isHorarioCompleted(String(horario).toUpperCase()))
    && !horariosConfig.every((horario) => isHorarioCompleted(String(horario).toUpperCase()));
  const singleDisplayHorario = normalizedFocusHorario
    || (horariosConfig.length === 1 ? String(horariosConfig[0]).toUpperCase() : null);

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
            onItemClick(itemId, e, normalizedFocusHorario);
          }}
          readOnly={readOnly}
          config={config}
          currentTimeOfDay={getCurrentTimeOfDay()}
          displayHorario={normalizedFocusHorario}
          rutina={rutina}
          section={section}
          itemId={itemId}
        />
      );
    }

    if (hasMultipleFranjas) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.35,
            flexShrink: 0,
            mr: 0.75,
          }}
        >
          {horariosConfig.map((horario) => {
            const normalizedHorario = String(horario).toUpperCase();
            const franjaCompleted = isHorarioCompleted(normalizedHorario);
            return (
              <HabitIconButton
                key={normalizedHorario}
                isCompleted={franjaCompleted}
                isPartialPending={habitPartiallyComplete && !franjaCompleted}
                Icon={Icon}
                onClick={(e) => {
                  e.stopPropagation();
                  onItemClick(itemId, e, normalizedHorario);
                }}
                readOnly={readOnly}
                config={config}
                currentTimeOfDay={getCurrentTimeOfDay()}
                displayHorario={normalizedHorario}
                rutina={rutina}
                section={section}
                itemId={itemId}
                size={36}
                mr={0}
              />
            );
          })}
        </Box>
      );
    }

    return (
      <HabitIconButton
        isCompleted={isCompleted}
        Icon={Icon}
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(itemId, e, singleDisplayHorario);
        }}
        readOnly={readOnly}
        config={config}
        currentTimeOfDay={getCurrentTimeOfDay()}
        displayHorario={singleDisplayHorario}
        rutina={rutina}
        section={section}
        itemId={itemId}
      />
    );
  };

  return (
    <ListItem disablePadding sx={rutinaChecklistItemSx}>
      <Box sx={rutinaChecklistRowSx}>
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
        <Box sx={rutinaChecklistContentSx}>
          <Box sx={rutinaChecklistTextColumnSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={rutinaChecklistLabelSx(isCompleted)}>
                {habitLabel || itemId}
              </Typography>
            </Box>
            {config && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={rutinaChecklistMetaSx}>
                  {secondaryText}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        {!readOnly && isCustomHabit && onEditHabit && (
          <Box sx={rutinaRowActionsSx}>
            <HabitCrudActions
              onEdit={onEditHabit}
              itemName={habitCrudItemName}
              showEdit
              showDelete={false}
              size="small"
              gap={0}
              sx={rutinaSystemButtonsSx}
            />
          </Box>
        )}
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
    prevProps.isCustomHabit === nextProps.isCustomHabit &&
    prevProps.config?.tipo === nextProps.config?.tipo &&
    prevProps.config?.frecuencia === nextProps.config?.frecuencia &&
    prevProps.config?.activo === nextProps.config?.activo &&
    prevHorarios === nextHorarios &&
    prevCompletion === nextCompletion &&
    prevProps.focusHorario === nextProps.focusHorario
  );
});
