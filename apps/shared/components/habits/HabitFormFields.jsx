import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import InlineItemConfigImproved, { HABIT_CADENCE_TAB_COLUMN_MIN_WIDTH } from './InlineItemConfigImproved.jsx';
import HabitFormSectionLabel from './HabitFormSectionLabel.jsx';
import {
  TareaFormRow,
  TareaFormPillSelect,
  HabitIconPicker,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import { HABIT_SECTION_OPTIONS } from '@shared/habits/form/habitFormDefaults.js';

/**
 * Campos de hábito con look & feel alineado a Google Calendar / taskFormUi.
 */
export default function HabitFormFields({
  section,
  onSectionChange,
  icon,
  onIconChange,
  config,
  onConfigChange,
  errors = {},
  showSection = true,
  showIconPicker = true,
  showCadence = true,
  showCadenceLabel = false,
  hideCadenceTopDivider = false,
  sectionMinimal = false,
  sectionOptions = HABIT_SECTION_OPTIONS,
  onCreateSection,
  createSectionLabel = 'Nuevo grupo',
}) {
  const handleConfigChange = useCallback((newConfig) => {
    onConfigChange?.(newConfig);
  }, [onConfigChange]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {showSection && !sectionMinimal && (
        <TareaFormRow icon={TareaFormIcons.habit} showDivider={false} align="center">
          <TareaFormPillSelect
            value={section}
            onChange={(e) => onSectionChange(e.target.value)}
            options={sectionOptions}
            emptyLabel="Seleccionar grupo"
            error={errors.section}
            onCreate={onCreateSection}
            createLabel={createSectionLabel}
          />
        </TareaFormRow>
      )}

      {showIconPicker && (
        <TareaFormRow icon={TareaFormIcons.habitIcon} showDivider={false} align="center">
          <HabitIconPicker
            value={icon}
            onChange={onIconChange}
            error={errors.icon}
          />
        </TareaFormRow>
      )}

      {showCadence && (
        <Box sx={{ width: '100%' }}>
          {showCadenceLabel && (
            <Box sx={{ display: 'flex', width: '100%' }}>
              <Box sx={{ minWidth: HABIT_CADENCE_TAB_COLUMN_MIN_WIDTH, flexShrink: 0 }}>
                <HabitFormSectionLabel inset="tab">Frecuencia</HabitFormSectionLabel>
              </Box>
            </Box>
          )}
          <InlineItemConfigImproved
            config={config}
            onConfigChange={handleConfigChange}
            itemId="new-habit-inline"
            sectionId={section}
            hideActions
            hideTopDivider={hideCadenceTopDivider}
          />
        </Box>
      )}
    </Box>
  );
}
