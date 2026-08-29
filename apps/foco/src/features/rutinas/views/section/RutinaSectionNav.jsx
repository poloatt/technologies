/**
 * @deprecated Vista por grupo retirada de la UI (ago 2026). RutinaTable usa solo cadencia.
 * Pendiente: eliminar o readaptar esta navegación lateral por sección.
 */
import React, { useMemo } from 'react';

import { Box, Typography } from '@mui/material';

import { DynamicIcon } from '@shared/components/common/DynamicIcon';

import { getRutinaSectionIconKey } from '@shared/navigation/rutinaSectionIcons';

import {

  categorizeSectionHabits,

  resolveHabitSections,

  resolveSectionLabel,

  resolveSectionIconKey,

  isCustomHabitSection,

} from '@shared/habits';

import { hubSectionBg } from '@shared/styles/hubSectionStyles';

import AddHabitGroupButton, { AddHabitGroupButtonWrap } from '@shared/components/habits/AddHabitGroupButton';

import HabitGroupContextMenu from '@shared/components/habits/HabitGroupContextMenu';

import useHabitGroupContextMenu from '@shared/hooks/useHabitGroupContextMenu';



const navItemSx = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 1,
  py: 0.5,
  borderRadius: 1.5,

  cursor: 'pointer',

  bgcolor: selected ? 'action.selected' : hubSectionBg,

  border: '1px solid',

  borderColor: selected ? 'primary.main' : 'divider',

  transition: 'border-color 0.15s, background-color 0.15s',

  '&:hover': {

    bgcolor: selected ? 'action.selected' : 'action.hover',

  },

});



export default function RutinaSectionNav({

  rutina,

  habits,

  habitsPreferences = {},

  customSections = [],

  selectedSection,

  onSelectSection,

  onAddGroup,

  onEditGroup,

  onDeleteGroup,

  readOnly = false,

}) {

  const canManageGroups = !readOnly && Boolean(onEditGroup && onDeleteGroup);

  const { menuState, closeMenu, getSectionHandlers } = useHabitGroupContextMenu({

    enabled: canManageGroups,

  });



  const sections = useMemo(

    () => resolveHabitSections(customSections),

    [customSections],

  );



  return (

    <>

      <Box

        component="nav"

        aria-label="Grupos de hábitos"

        sx={{

          display: 'flex',

          flexDirection: 'column',

          gap: 0.75,

          minWidth: 220,

          maxWidth: 260,

          flexShrink: 0,

        }}

      >

        {sections.map((section) => {

          const { completed, incomplete } = categorizeSectionHabits({

            section,

            rutina,

            habits,

            habitsPreferences,

          });

          const label = resolveSectionLabel(section, customSections);

          const customIconKey = resolveSectionIconKey(section, customSections);

          const iconKey = customIconKey || getRutinaSectionIconKey(section);

          const isCustom = isCustomHabitSection(section);

          const contextHandlers = getSectionHandlers(section, isCustom);
          const { onClick: onContextMenuClick, ...restContextHandlers } = contextHandlers;

          return (
            <Box
              key={section}
              role="button"
              tabIndex={0}
              aria-pressed={selectedSection === section}
              onClick={(event) => {
                onContextMenuClick?.(event);
                if (!event.defaultPrevented) {
                  onSelectSection(section);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSection(section);
                }
              }}
              {...restContextHandlers}
              sx={navItemSx(selectedSection === section)}
            >

              <DynamicIcon

                iconKey={iconKey}

                size="small"

                sx={{ color: 'text.secondary', flexShrink: 0 }}

              />

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.8125rem',
                  lineHeight: 1.25,
                }}
              >
                {label}

              </Typography>

              <Typography variant="caption" color="text.disabled">

                {completed.length}/{completed.length + incomplete.length}

              </Typography>

            </Box>

          );

        })}



        {!readOnly && onAddGroup && (

          <AddHabitGroupButtonWrap>

            <AddHabitGroupButton onClick={onAddGroup} />

          </AddHabitGroupButtonWrap>

        )}

      </Box>



      {canManageGroups && (

        <HabitGroupContextMenu

          open={menuState.open}

          anchorPosition={menuState.anchorPosition}

          onClose={closeMenu}

          onEdit={() => {

            if (menuState.sectionId) onEditGroup(menuState.sectionId);

            closeMenu();

          }}

          onDelete={() => {

            if (menuState.sectionId) onDeleteGroup(menuState.sectionId);

            closeMenu();

          }}

        />

      )}

    </>

  );

}


