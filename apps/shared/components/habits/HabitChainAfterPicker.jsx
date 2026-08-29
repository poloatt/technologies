import React, { useMemo, useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { getIconByName } from '@shared/utils/iconConfig';
import { buildHabitManagerSections } from '@shared/habits/form/habitsManagerUtils';
import { normalizeHabitStep, stepsEqual } from '@shared/habits';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';

function stepKey(section, habitId) {
  return `${section}:${habitId}`;
}

function HabitPickRow({ habit, selected, onToggle }) {
  const Icon = getIconByName(habit.icon);
  const habitId = habit.id || habit._id;

  return (
    <Box
      role="option"
      aria-selected={selected}
      onClick={() => onToggle(habitId)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        px: 1.25,
        py: 0.75,
        mb: 0.5,
        borderRadius: 1.5,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? 'text.primary' : 'divider',
        bgcolor: 'transparent',
        boxShadow: 'none',
        transition: 'border-color 0.15s ease',
        '&:hover': {
          borderColor: selected ? 'text.primary' : 'text.secondary',
        },
      }}
    >
      {Icon && (
        <Icon
          sx={{
            fontSize: '1.1rem',
            color: selected ? 'text.primary' : 'text.secondary',
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        variant="body2"
        sx={{
          fontWeight: selected ? 600 : 500,
          color: selected ? 'text.primary' : 'text.secondary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
          fontSize: '0.8125rem',
        }}
      >
        {habit.label}
      </Typography>
    </Box>
  );
}

/**
 * Multi-select minimal de hábitos con pestañas por grupo.
 */
export default function HabitChainAfterPicker({
  habits = {},
  customSections = [],
  linkedSteps = [],
  onChange,
  excludeSection = '',
  excludeHabitId = null,
  flat = false,
}) {
  const sections = useMemo(
    () => buildHabitManagerSections(customSections),
    [customSections],
  );

  const habitsBySection = useMemo(() => {
    const map = {};
    sections.forEach(({ value }) => {
      map[value] = (habits[value] || [])
        .filter((h) => h?.activo !== false)
        .filter((h) => {
          const id = h.id || h._id;
          if (!id) return false;
          if (value === excludeSection && id === excludeHabitId) return false;
          return true;
        })
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });
    return map;
  }, [habits, sections, excludeSection, excludeHabitId]);

  const sectionsWithHabits = useMemo(
    () => sections.filter(({ value }) => (habitsBySection[value]?.length || 0) > 0),
    [sections, habitsBySection],
  );

  const selectedKeys = useMemo(
    () => new Set(
      (linkedSteps || [])
        .map((step) => normalizeHabitStep(step))
        .filter(Boolean)
        .map((step) => stepKey(step.section, step.habitId)),
    ),
    [linkedSteps],
  );

  const [activeSection, setActiveSection] = useState(
    () => sectionsWithHabits[0]?.value || sections[0]?.value || 'bodyCare',
  );

  const visibleHabits = habitsBySection[activeSection] || [];

  const toggleHabit = (section, habitId) => {
    const step = { section, habitId };
    const key = stepKey(section, habitId);
    const current = (linkedSteps || []).map(normalizeHabitStep).filter(Boolean);

    if (selectedKeys.has(key)) {
      onChange?.(current.filter((s) => !stepsEqual(s, step)));
      return;
    }
    onChange?.([...current, step]);
  };

  if (sectionsWithHabits.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        {HABIT_CHAIN_COPY.noHabitsAvailable}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        ...(flat
          ? { bgcolor: 'transparent', border: 'none', borderRadius: 0 }
          : {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            bgcolor: 'background.default',
          }),
        overflow: 'hidden',
      }}
    >
      <Tabs
        value={activeSection}
        onChange={(_, value) => setActiveSection(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          bgcolor: 'background.default',
          minHeight: 40,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 40,
            py: 1,
            px: 1.5,
            fontSize: '0.8125rem',
            fontWeight: 600,
            textTransform: 'none',
          },
        }}
      >
        {sectionsWithHabits.map(({ value, label }) => (
          <Tab key={value} label={label} value={value} />
        ))}
      </Tabs>

      <Box
        role="listbox"
        aria-multiselectable="true"
        aria-label={HABIT_CHAIN_COPY.pickLabel}
        sx={{
          pt: 0.75,
          pb: 0.25,
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {visibleHabits.map((habit) => {
          const habitId = habit.id || habit._id;
          const key = stepKey(activeSection, habitId);
          return (
            <HabitPickRow
              key={key}
              habit={habit}
              selected={selectedKeys.has(key)}
              onToggle={(id) => toggleHabit(activeSection, id)}
            />
          );
        })}

        {visibleHabits.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
            {HABIT_CHAIN_COPY.emptySection}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
