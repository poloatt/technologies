import React from 'react';
import { Stack } from '@mui/material';
import {
  TareaFormRow,
  TareaFormPillButton,
  TaskFormEstadoRow,
  TAREA_FORM_ESTADO_OPTIONS,
  tareaFormPillIconSx,
  tareaFormPillRowSx,
  tareaFormRowContentGutterSx,
} from './tareaFormUi';
import { TareaFormIcons } from './tareaFormIcons';
import TareaFormRecurrencePicker from './TareaFormRecurrencePicker';

/**
 * Fila unificada: Estado | Prioridad | Cadencia (pills compartidos).
 */
export default function TareaFormSettingsRow({
  estado,
  onEstadoChange,
  prioridad,
  onPrioridadChange,
  showPrioridad = true,
  showRecurrence = true,
  recurrenceRrule = null,
  onRecurrenceChange,
  tipo = 'TAREA',
  errors = {},
  estadoOptions = TAREA_FORM_ESTADO_OPTIONS,
  entityType = 'TAREA',
}) {
  const handleEstadoChange = (valueOrEvent) => {
    if (typeof valueOrEvent === 'string') {
      onEstadoChange?.({ target: { value: valueOrEvent } });
      return;
    }
    onEstadoChange?.(valueOrEvent);
  };

  return (
    <TareaFormRow icon={TareaFormIcons.estado} showDivider={false} align="center">
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        gap={0.75}
        useFlexGap
        sx={{ ...tareaFormPillRowSx, ...tareaFormRowContentGutterSx }}
      >
        <TaskFormEstadoRow
          value={estado || 'PENDIENTE'}
          onChange={handleEstadoChange}
          options={estadoOptions}
          entityType={entityType}
        />

        {showPrioridad && tipo !== 'EVENTO' && onPrioridadChange && (
          <TareaFormPillButton
            variant="settings"
            onClick={() => onPrioridadChange(prioridad === 'ALTA' ? 'BAJA' : 'ALTA')}
            aria-label="Prioridad"
            sx={{ color: prioridad === 'ALTA' ? 'error.main' : 'text.primary' }}
          >
            <TareaFormIcons.prioridad sx={tareaFormPillIconSx} />
            {prioridad === 'ALTA' ? 'Alta' : 'Baja'}
          </TareaFormPillButton>
        )}

        {showRecurrence && onRecurrenceChange && (
          <TareaFormRecurrencePicker
            variant="settings"
            value={recurrenceRrule}
            onChange={onRecurrenceChange}
          />
        )}
      </Stack>
    </TareaFormRow>
  );
}
