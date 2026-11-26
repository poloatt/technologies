import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  TareaFormRow,
  TareaFormPillSelect,
  TareaFormPillSelectRenameRow,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import { EMPTY_ROUTINE_ASSIGNMENT } from '@shared/habits/routines';
import {
  isCustomHabitSection,
  resolveSectionLabel,
} from '@shared/habits';
import HabitFormSectionLabel from './HabitFormSectionLabel.jsx';
import HabitGroupTabs from './HabitGroupTabs.jsx';
import { RoutineAssignmentFields } from './routines';

/**
 * Filas de metadatos del hábito (estilo Google Calendar): Grupo + Rutina.
 * Con showGroup/showRoutine se puede componer el orden (grupo → cadencia → rutina).
 */
export default function HabitFormMetaRows({
  section,
  onSectionChange,
  sectionOptions = [],
  sectionError,
  onCreateSection,
  createSectionLabel = 'Nuevo grupo',
  chainConfig = EMPTY_ROUTINE_ASSIGNMENT,
  onChainConfigChange,
  habitChains = [],
  habits = {},
  currentSection = '',
  currentHabitId = null,
  customSections = [],
  chainError,
  showGroup = true,
  showRoutine = true,
  routinePickerInline = true,
  showRowIcons = true,
  showGroupDivider = true,
  showFieldLabels = false,
  enablePillRename = false,
  onSectionRenameSave,
  onSectionEdit,
  onRoutineRenameSave,
  onCreateRoutine,
  onEditRoutine,
  /** 'select' (pill desplegable) | 'tabs' (misma UX de grupos que el gestor de rutinas). */
  groupSelector = 'select',
  groupLabel = 'Grupo',
}) {
  const groupRenameValue = resolveSectionLabel(section, customSections);
  const canRenameGroup = enablePillRename && isCustomHabitSection(section);

  const groupPillSelectProps = {
    value: section,
    onChange: (event) => onSectionChange?.(event.target.value),
    options: sectionOptions,
    emptyLabel: 'Seleccionar grupo',
    error: sectionError,
    onCreate: onCreateSection,
    createLabel: createSectionLabel,
    pillWidth: 'full',
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      gap: showGroup && showRoutine ? 1.25 : 0,
    }}>
      {showGroup && (
        <Box sx={{ width: '100%' }}>
          {showFieldLabels && (
            <HabitFormSectionLabel
              inset={groupSelector === 'tabs' ? 'none' : 'pill'}
              sx={groupSelector === 'tabs' ? { textAlign: 'center' } : undefined}
            >
              {groupLabel}
            </HabitFormSectionLabel>
          )}
          {groupSelector === 'tabs' ? (
            <>
              <HabitGroupTabs
                sections={sectionOptions}
                value={section}
                onChange={onSectionChange}
                onCreate={onCreateSection}
                createLabel={createSectionLabel}
                onEdit={canRenameGroup && onSectionEdit ? () => onSectionEdit(section) : undefined}
              />
              {sectionError ? (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  {sectionError}
                </Typography>
              ) : null}
            </>
          ) : (
            <TareaFormRow
              icon={showRowIcons ? TareaFormIcons.folder : null}
              showDivider={showGroupDivider}
              align="center"
              compact={showFieldLabels}
            >
              {enablePillRename ? (
                <TareaFormPillSelectRenameRow
                  renameValue={groupRenameValue}
                  canRename={canRenameGroup}
                  onEditClick={canRenameGroup ? () => onSectionEdit?.(section) : undefined}
                  onRenameSave={(label) => onSectionRenameSave?.(section, label)}
                  renamePlaceholder="Nombre del grupo"
                  pillSelectProps={groupPillSelectProps}
                />
              ) : (
                <TareaFormPillSelect {...groupPillSelectProps} />
              )}
            </TareaFormRow>
          )}
        </Box>
      )}

      {showRoutine && (
        <Box sx={{ width: '100%' }}>
          {showFieldLabels && <HabitFormSectionLabel inset="pill">Rutina</HabitFormSectionLabel>}
          <RoutineAssignmentFields
            config={chainConfig}
            onChange={onChainConfigChange}
            habitChains={habitChains}
            habits={habits}
            currentSection={currentSection}
            currentHabitId={currentHabitId}
            customSections={customSections}
            error={chainError}
            showPicker={routinePickerInline}
            showRowIcon={showRowIcons}
            compact={showFieldLabels}
            enablePillRename={enablePillRename}
            onRoutineRenameSave={onRoutineRenameSave}
            onCreateRoutine={onCreateRoutine}
            onEditRoutine={onEditRoutine}
          />
        </Box>
      )}
    </Box>
  );
}

