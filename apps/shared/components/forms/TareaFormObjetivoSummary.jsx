import React, { useEffect, useState } from 'react';
import { Box, Collapse, Stack } from '@mui/material';
import CollapseChevron from '../common/CollapseChevron';
import { collapsePanelProps } from '../../styles/collapseSectionStyles';
import {
  TareaFormRow,
  TareaFormPrimaryLine,
  TareaFormSecondaryLine,
} from './tareaFormLayout';
import { TaskFormEstadoRow, TareaFormPillSelect } from './tareaFormControls';
import {
  TAREA_FORM_ESTADO_OPTIONS,
  getTaskFormEstadoOptions,
  tareaFormRowContentGutterSx,
  taskFormReadOnlyBodyLineSx,
  TASK_FORM_ROW_GAP,
  TASK_FORM_ICON_COLUMN_WIDTH,
} from './tareaFormTokens';
import { TareaFormIcons } from './tareaFormIcons';
import { getEstadoText } from '../common/StatusSystem';

function labelForEstado(estado, entityType = 'TAREA') {
  const fromOptions = TAREA_FORM_ESTADO_OPTIONS.find((opt) => opt.value === estado)?.label;
  if (fromOptions) return fromOptions;
  return getEstadoText(estado, entityType) || 'Pendiente';
}

function joinMetaParts(parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * Objetivo + progreso (+ subtareas vacías) colapsable, mismo patrón que el horario.
 * Si hay subtareas, el listado vive fuera; aquí solo se anuncia "Sin subtareas".
 */
export default function TareaFormObjetivoSummary({
  estado = 'PENDIENTE',
  onEstadoChange,
  showEstado = true,
  showObjetivo = true,
  objetivoValue = '',
  onObjetivoChange,
  objetivoOptions = [],
  objetivoLabel: objetivoLabelProp,
  emptyObjetivoLabel = 'Sin objetivo',
  onCreateObjetivo,
  createObjetivoLabel = 'Nuevo objetivo',
  showSubtareas = false,
  subtareasCount = 0,
  emptySubtareasLabel = 'Sin subtareas',
  subtareaComposer = null,
  errors = {},
  entityType = 'TAREA',
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
}) {
  const hasSubtareas = subtareasCount > 0;
  const showEmptySubtareas = showSubtareas && !hasSubtareas;

  const [internalExpanded, setInternalExpanded] = useState(
    defaultExpanded || Boolean(errors?.objetivo),
  );
  const isExpanded = expandedProp ?? internalExpanded;

  const setExpanded = (next) => {
    onExpandedChange?.(next);
    if (expandedProp === undefined) {
      setInternalExpanded(next);
    }
  };

  useEffect(() => {
    if (errors?.objetivo) {
      setExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abrir solo cuando aparece error
  }, [errors?.objetivo]);

  const selectedObjetivo = objetivoOptions.find(
    (opt) => String(opt.value) === String(objetivoValue ?? ''),
  );
  const hasNamedObjetivo = Boolean(objetivoLabelProp || selectedObjetivo);
  const objetivoLabel = objetivoLabelProp
    || selectedObjetivo?.label
    || emptyObjetivoLabel;

  const estadoLabel = labelForEstado(estado || 'PENDIENTE', entityType);
  const primaryLine = showObjetivo ? objetivoLabel : estadoLabel;
  const secondaryLine = joinMetaParts([
    showObjetivo && showEstado ? estadoLabel : null,
    showEmptySubtareas ? emptySubtareasLabel : null,
  ]);

  const handleSummaryClick = () => setExpanded(!isExpanded);

  const handleEstadoChange = (valueOrEvent) => {
    if (typeof valueOrEvent === 'string') {
      onEstadoChange?.({ target: { value: valueOrEvent } });
      return;
    }
    onEstadoChange?.(valueOrEvent);
  };

  if (!showEstado && !showObjetivo && !showEmptySubtareas) return null;

  const showComposerInExpand = showEmptySubtareas && subtareaComposer;

  return (
    <>
      <TareaFormRow
        icon={showObjetivo ? TareaFormIcons.objetivo : TareaFormIcons.estado}
        showDivider={false}
        align="center"
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.5,
            width: '100%',
            minWidth: 0,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={handleSummaryClick}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Ocultar objetivo' : 'Editar objetivo'}
            sx={{
              ...tareaFormRowContentGutterSx,
              border: 'none',
              background: 'none',
              p: 0,
              m: 0,
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
              flex: 1,
              minWidth: 0,
              display: 'block',
              '&:hover': { opacity: 0.88 },
            }}
          >
            <TareaFormPrimaryLine
              sx={{
                ...taskFormReadOnlyBodyLineSx,
                fontWeight: 500,
                color: showObjetivo && !hasNamedObjetivo ? 'text.secondary' : 'text.primary',
              }}
            >
              {primaryLine}
              {showObjetivo && errors?.objetivo ? ' *' : ''}
            </TareaFormPrimaryLine>
            {secondaryLine ? (
              <TareaFormSecondaryLine>{secondaryLine}</TareaFormSecondaryLine>
            ) : null}
          </Box>
          <CollapseChevron
            expanded={isExpanded}
            asButton
            onClick={handleSummaryClick}
            aria-label={isExpanded ? 'Ocultar objetivo' : 'Editar objetivo'}
            iconButtonSx={{ flexShrink: 0, mt: 0.25 }}
          />
        </Box>
      </TareaFormRow>

      <Collapse in={isExpanded} {...collapsePanelProps}>
        <Stack
          spacing={1}
          sx={{
            pl: (theme) => `calc(${TASK_FORM_ICON_COLUMN_WIDTH}px + ${theme.spacing(TASK_FORM_ROW_GAP)})`,
            pr: 0.5,
            pb: 0.5,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {showEstado ? (
            <TaskFormEstadoRow
              value={estado || 'PENDIENTE'}
              onChange={handleEstadoChange}
              entityType={entityType}
              options={getTaskFormEstadoOptions(estado)}
            />
          ) : null}

          {showObjetivo && typeof onObjetivoChange === 'function' ? (
            <TareaFormPillSelect
              value={objetivoValue}
              onChange={onObjetivoChange}
              options={objetivoOptions}
              emptyLabel={emptyObjetivoLabel}
              error={errors?.objetivo}
              required
              pillWidth="grow"
              onCreate={onCreateObjetivo}
              createLabel={createObjetivoLabel}
            />
          ) : null}

          {showComposerInExpand ? subtareaComposer : null}
        </Stack>
      </Collapse>
    </>
  );
}
