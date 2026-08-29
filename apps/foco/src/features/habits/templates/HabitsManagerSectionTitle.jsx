import React, { useCallback, useEffect, useState } from 'react';
import {
  HabitFormTitleField,
  TareaFormTitleField,
} from '@shared/components/forms/tareaFormUi';
import {
  isCustomHabitSection,
  resolveSectionIconKey,
  resolveSectionLabel,
} from '@shared/habits';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';

/**
 * Título del grupo activo (estilo Google Calendar). Editable solo en grupos personalizados.
 */
export default function HabitsManagerSectionTitle({
  sectionId,
  customSections = [],
  onUpdateSection,
  disabled = false,
}) {
  const isCustom = isCustomHabitSection(sectionId);
  const savedLabel = resolveSectionLabel(sectionId, customSections);
  const savedIcon = resolveSectionIconKey(sectionId, customSections) || DEFAULT_HABIT_ICON;

  const [label, setLabel] = useState(savedLabel);
  const [icon, setIcon] = useState(savedIcon);

  useEffect(() => {
    setLabel(savedLabel);
    setIcon(savedIcon);
  }, [sectionId, savedLabel, savedIcon]);

  const persistSection = useCallback(async (nextLabel, nextIcon) => {
    if (!isCustom || disabled || !onUpdateSection) return;
    const trimmed = (nextLabel || '').trim();
    if (!trimmed) return;
    if (trimmed === savedLabel && nextIcon === savedIcon) return;
    await onUpdateSection(sectionId, { label: trimmed, icon: nextIcon });
  }, [isCustom, disabled, onUpdateSection, sectionId, savedLabel, savedIcon]);

  const handleBlur = useCallback(() => {
    persistSection(label, icon);
  }, [persistSection, label, icon]);

  const handleIconChange = useCallback(async (nextIcon) => {
    setIcon(nextIcon);
    await persistSection(label, nextIcon);
  }, [persistSection, label]);

  if (isCustom) {
    return (
      <HabitFormTitleField
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={handleBlur}
        icon={icon}
        onIconChange={handleIconChange}
        placeholder="Nombre de la rutina"
        disabled={disabled}
      />
    );
  }

  return (
    <TareaFormTitleField
      value={savedLabel}
      readOnly
      placeholder="Nombre de la rutina"
    />
  );
}
