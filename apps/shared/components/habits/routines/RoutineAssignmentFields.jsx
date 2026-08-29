import React, { useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import {
  TareaFormRow,
  TareaFormPillSelect,
  TareaFormPillSelectRenameRow,
  taskFormScheduleExpandedContentSx,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';
import {
  buildChainSelectOptions,
  resolveRoutineSelectValue,
  applyRoutineSelectChange,
  createNewRoutineAssignment,
  EMPTY_ROUTINE_ASSIGNMENT,
  NEW_HABIT_CHAIN_VALUE,
} from '@shared/habits/routines';
import HabitChainAfterPicker from '../HabitChainAfterPicker.jsx';

/**
 * Gestión de rutina: asignar rutina existente o crear nueva (apilamiento de hábitos).
 */
export default function RoutineAssignmentFields({
  config = EMPTY_ROUTINE_ASSIGNMENT,
  onChange,
  habitChains = [],
  habits = {},
  currentSection = '',
  currentHabitId = null,
  customSections = [],
  error,
  showDivider = false,
  showPicker = true,
  showRowIcon = true,
  compact = false,
  enablePillRename = false,
  onRoutineRenameSave,
}) {
  const chainOptions = useMemo(
    () => buildChainSelectOptions(habitChains, habits),
    [habitChains, habits],
  );

  const selectValue = useMemo(
    () => resolveRoutineSelectValue(config),
    [config],
  );

  const routineRenameValue = useMemo(() => {
    if (!config.enabled) return '';
    if (config.label?.trim()) return config.label.trim();
    if (config.chainId && config.chainId !== NEW_HABIT_CHAIN_VALUE) {
      const chain = (habitChains || []).find((entry) => entry.id === config.chainId);
      return chain?.label?.trim() || '';
    }
    return '';
  }, [config, habitChains]);

  const handleSelect = useCallback((event) => {
    onChange?.(applyRoutineSelectChange(event.target.value, {
      habitChains,
      currentSection,
      currentHabitId,
      currentConfig: config,
    }));
  }, [config, currentHabitId, currentSection, habitChains, onChange]);

  const handleCreateRoutine = useCallback(() => {
    onChange?.(createNewRoutineAssignment());
  }, [onChange]);

  const updateLinkedSteps = useCallback((linkedSteps) => {
    onChange?.({ ...config, linkedSteps });
  }, [config, onChange]);

  const handleRoutineRenameSave = useCallback(async (label) => {
    onChange?.({ ...config, label });
    await onRoutineRenameSave?.(label, config);
  }, [config, onChange, onRoutineRenameSave]);

  const shouldShowPicker = showPicker && config.enabled;

  const routinePillSelectProps = {
    value: selectValue,
    onChange: handleSelect,
    options: chainOptions,
    emptyLabel: HABIT_CHAIN_COPY.noRoutine,
    onCreate: handleCreateRoutine,
    createLabel: HABIT_CHAIN_COPY.newRoutine,
    pillWidth: 'full',
    showEmptyOption: true,
    error,
  };

  return (
    <TareaFormRow
      icon={showRowIcon ? TareaFormIcons.rutina : null}
      showDivider={showDivider}
      align={config.enabled ? 'flex-start' : 'center'}
      compact={compact}
    >
      <Box sx={{ width: '100%', minWidth: 0 }}>
        {enablePillRename ? (
          <TareaFormPillSelectRenameRow
            renameValue={routineRenameValue}
            canRename={config.enabled}
            onRenameSave={handleRoutineRenameSave}
            renamePlaceholder="Nombre de la rutina"
            pillSelectProps={routinePillSelectProps}
          />
        ) : (
          <TareaFormPillSelect {...routinePillSelectProps} />
        )}
        {shouldShowPicker && (
          <Box sx={{
            ...(showRowIcon ? taskFormScheduleExpandedContentSx : { width: '100%', boxSizing: 'border-box' }),
            pt: 1,
            pb: 0.25,
          }}
          >
            <HabitChainAfterPicker
              habits={habits}
              customSections={customSections}
              linkedSteps={config.linkedSteps || []}
              excludeSection={currentSection}
              excludeHabitId={currentHabitId}
              onChange={updateLinkedSteps}
              flat
            />
          </Box>
        )}
        {error && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, px: 0.5 }}>
            {error}
          </Typography>
        )}
      </Box>
    </TareaFormRow>
  );
}
