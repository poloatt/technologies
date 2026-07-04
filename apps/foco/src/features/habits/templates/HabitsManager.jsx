import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, Typography, Box, Button } from '@mui/material';
import { useResponsive, useHabitSectionCreateOption } from '@shared/hooks';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import { useHabits, useRutinas } from '@shared/context';
import clienteAxios from '@shared/config/axios';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
} from '@shared/components/forms/tareaFormUi';
import { generateHabitId } from '@shared/habits/form';
import { invalidateHabitsPreferencesCache } from '@shared/hooks/useHabitsPreferences';
import { DEFAULT_HABIT_CONFIG } from '@shared/habits/form';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import {
  getDefaultHabitConfig,
  getHabitConfig,
  normalizeManagerConfig,
} from '@shared/habits/form/habitsManagerUtils';
import HabitsManagerSectionTabs from './HabitsManagerSectionTabs';
import HabitsManagerList from './HabitsManagerList';
import HabitsManagerDetail from './HabitsManagerDetail';

const EMPTY_FORM = {
  label: '',
  icon: DEFAULT_HABIT_ICON,
  section: 'bodyCare',
  config: { ...DEFAULT_HABIT_CONFIG },
};

export const HabitsManager = ({ open, onClose }) => {
  const { isMobile } = useResponsive();
  const {
    habits,
    loading,
    fetchHabits,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
  } = useHabits();
  const { updateUserHabitPreference } = useRutinas();

  const [currentSection, setCurrentSection] = useState('bodyCare');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [habitsConfig, setHabitsConfig] = useState({});
  const [editDraft, setEditDraft] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [mobileListExpanded, setMobileListExpanded] = useState(false);
  const habitsRef = useRef(habits);
  const editDraftHabitIdRef = useRef(null);

  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const handleSectionCreated = useCallback((sectionId) => {
    setCurrentSection(sectionId);
    setFormData((prev) => ({ ...prev, section: sectionId }));
    setEditDraft((prev) => (prev ? { ...prev, section: sectionId } : prev));
  }, []);

  const { sectionOptions: sections, sectionSelectProps, groupDialogProps } = useHabitSectionCreateOption({
    onSectionCreated: handleSectionCreated,
  });

  const currentHabits = habits[currentSection] || [];
  const sortedHabits = useMemo(
    () => [...currentHabits].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [currentHabits],
  );

  const sectionLabel = sections.find((s) => s.value === currentSection)?.label || currentSection;
  const selectedHabit = sortedHabits.find((h) => h.id === selectedHabitId) || null;

  const fetchHabitsConfig = useCallback(async () => {
    try {
      const response = await clienteAxios.get('/api/users/preferences/habits');
      const loadedConfig = response.data?.habits || {};
      const initializedConfig = { ...loadedConfig };
      const sectionHabits = habitsRef.current[currentSection] || [];

      sectionHabits.forEach((habit) => {
        if (!initializedConfig[currentSection]) {
          initializedConfig[currentSection] = {};
        }
        if (!initializedConfig[currentSection][habit.id]) {
          initializedConfig[currentSection][habit.id] = getDefaultHabitConfig(habit);
        }
      });

      setHabitsConfig(initializedConfig);
    } catch (error) {
      console.error('[HabitsManager] Error al cargar configuraci?n:', error);
      setHabitsConfig({});
    }
  }, [currentSection]);

  useEffect(() => {
    if (open) {
      fetchHabits();
      fetchHabitsConfig();
    } else {
      setMobileListExpanded(false);
    }
  }, [open, fetchHabits, fetchHabitsConfig]);

  useEffect(() => {
    if (!open || showAddForm || !selectedHabit) {
      setEditDraft(null);
      editDraftHabitIdRef.current = null;
      return;
    }
    if (editDraftHabitIdRef.current === selectedHabit.id) return;

    const config = getHabitConfig(habitsConfig, currentSection, selectedHabit.id, selectedHabit);
    setEditDraft({
      label: selectedHabit.label,
      icon: selectedHabit.icon,
      section: currentSection,
      config: normalizeManagerConfig(config),
    });
    editDraftHabitIdRef.current = selectedHabit.id;
  }, [open, showAddForm, selectedHabit, selectedHabitId, habitsConfig, currentSection]);

  const isEditDirty = useMemo(() => {
    if (!editDraft || !selectedHabit) return false;
    const savedConfig = normalizeManagerConfig(
      getHabitConfig(habitsConfig, currentSection, selectedHabit.id, selectedHabit),
    );
    return (
      editDraft.label !== selectedHabit.label
      || editDraft.icon !== selectedHabit.icon
      || editDraft.section !== currentSection
      || JSON.stringify(editDraft.config) !== JSON.stringify(savedConfig)
    );
  }, [editDraft, selectedHabit, habitsConfig, currentSection]);

  useEffect(() => {
    if (!open || showAddForm) return;
    if (sortedHabits.length === 0) {
      setSelectedHabitId(null);
      return;
    }
    if (!selectedHabitId || !sortedHabits.some((h) => h.id === selectedHabitId)) {
      setSelectedHabitId(sortedHabits[0].id);
    }
  }, [open, sortedHabits, selectedHabitId, showAddForm]);

  const resetEditDraft = useCallback(() => {
    if (!selectedHabit) {
      setEditDraft(null);
      editDraftHabitIdRef.current = null;
      return;
    }
    const config = getHabitConfig(habitsConfig, currentSection, selectedHabit.id, selectedHabit);
    setEditDraft({
      label: selectedHabit.label,
      icon: selectedHabit.icon,
      section: currentSection,
      config: normalizeManagerConfig(config),
    });
    editDraftHabitIdRef.current = selectedHabit.id;
  }, [selectedHabit, habitsConfig, currentSection]);

  const handleConfigChange = useCallback(async (habitId, newConfig, sectionOverride = currentSection) => {
    const normalizedConfig = normalizeManagerConfig(newConfig);

    try {
      if (updateUserHabitPreference) {
        await updateUserHabitPreference(sectionOverride, habitId, normalizedConfig, true);
      } else {
        await clienteAxios.put('/api/users/preferences/habits', {
          habits: { [sectionOverride]: { [habitId]: normalizedConfig } },
          applyFrom: 'today',
        }, { params: { applyFrom: 'today' } });
        invalidateHabitsPreferencesCache();
      }

      setHabitsConfig((prev) => ({
        ...prev,
        [sectionOverride]: {
          ...(prev[sectionOverride] || {}),
          [habitId]: normalizedConfig,
        },
      }));
    } catch (error) {
      console.error('[HabitsManager] Error al guardar configuraci?n:', error);
      throw error;
    }
  }, [currentSection, updateUserHabitPreference]);

  const handleUpdateHabit = useCallback(async (habitId, label, extra = {}) => {
    const habit = sortedHabits.find((h) => h.id === habitId);
    if (!habit) return;
    try {
      await updateHabit(habitId, currentSection, {
        label: label ?? habit.label,
        icon: extra.icon ?? habit.icon,
        activo: habit.activo !== undefined ? habit.activo : true,
      });
      await fetchHabits();
    } catch (error) {
      console.error('[HabitsManager] Error al actualizar h?bito:', error);
      throw error;
    }
  }, [sortedHabits, updateHabit, currentSection, fetchHabits]);

  const handleCancelEdit = useCallback(() => {
    resetEditDraft();
  }, [resetEditDraft]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedHabit || !editDraft) return;

    const trimmedLabel = (editDraft.label || '').trim();
    if (!trimmedLabel) {
      setErrors({ label: 'El nombre es requerido' });
      return;
    }
    setErrors({});

    const habitId = selectedHabit.id;
    const normalizedConfig = normalizeManagerConfig(editDraft.config);
    const targetSection = editDraft.section || currentSection;

    try {
      setIsSavingEdit(true);

      if (targetSection !== currentSection) {
        await deleteHabit(habitId, currentSection);
        const orden = habits[targetSection]?.length || 0;
        await addHabit(targetSection, {
          id: habitId,
          label: trimmedLabel,
          icon: editDraft.icon,
          activo: selectedHabit.activo !== undefined ? selectedHabit.activo : true,
          orden,
        });
        await handleConfigChange(habitId, normalizedConfig, targetSection);
        setHabitsConfig((prev) => {
          const updated = { ...prev };
          if (updated[currentSection]?.[habitId]) {
            delete updated[currentSection][habitId];
          }
          return updated;
        });
        setCurrentSection(targetSection);
        setSelectedHabitId(habitId);
      } else {
        const metadataChanged = trimmedLabel !== selectedHabit.label || editDraft.icon !== selectedHabit.icon;
        if (metadataChanged) {
          await handleUpdateHabit(habitId, trimmedLabel, { icon: editDraft.icon });
        }
        await handleConfigChange(habitId, normalizedConfig);
      }

      await fetchHabits();
      await fetchHabitsConfig();
      editDraftHabitIdRef.current = null;
      resetEditDraft();
    } catch {
      // manejado arriba o en contexto
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    selectedHabit,
    editDraft,
    currentSection,
    habits,
    deleteHabit,
    addHabit,
    handleConfigChange,
    handleUpdateHabit,
    fetchHabits,
    fetchHabitsConfig,
    resetEditDraft,
  ]);

  const handleSectionChange = (_event, newValue) => {
    setCurrentSection(newValue);
    setShowAddForm(false);
    setSelectedHabitId(null);
    setMobileListExpanded(false);
    setFormData({ ...EMPTY_FORM, section: newValue });
    setErrors({});
    fetchHabitsConfig();
  };

  const handleAddClick = () => {
    setShowAddForm(true);
    setSelectedHabitId(null);
    setFormData({ ...EMPTY_FORM, section: currentSection });
    setErrors({});
  };

  useEffect(() => {
    const handleHeaderAddButtonClick = (event) => {
      if (event.detail?.type === 'habit') {
        handleAddClick();
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButtonClick);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButtonClick);
  }, [currentSection]);

  const handleCancelCreate = () => {
    setShowAddForm(false);
    setFormData({ ...EMPTY_FORM, section: currentSection });
    setErrors({});
    if (sortedHabits.length > 0) {
      setSelectedHabitId(sortedHabits[0].id);
    }
  };

  const validateCreateForm = () => {
    const newErrors = {};
    const trimmedLabel = (formData.label || '').trim();
    if (!trimmedLabel) {
      newErrors.label = 'El nombre es requerido';
    }
    if (!formData.icon) {
      newErrors.icon = 'Debe seleccionar un icono';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveCreate = async () => {
    if (!validateCreateForm()) return;

    const targetSection = formData.section || currentSection;
    let habitId = generateHabitId(formData.label);
    let counter = 1;
    const baseId = habitId;
    while (habits[targetSection]?.some((h) => h.id === habitId)) {
      habitId = `${baseId}${counter}`;
      counter += 1;
    }

    try {
      const orden = habits[targetSection]?.length || 0;
      await addHabit(targetSection, {
        id: habitId,
        label: formData.label.trim(),
        icon: formData.icon,
        activo: true,
        orden,
      });

      const defaultConfig = normalizeManagerConfig(formData.config || DEFAULT_HABIT_CONFIG);

      if (updateUserHabitPreference) {
        await updateUserHabitPreference(targetSection, habitId, defaultConfig, true);
      } else {
        await clienteAxios.put('/api/users/preferences/habits', {
          habits: { [targetSection]: { [habitId]: defaultConfig } },
          applyFrom: 'today',
        }, { params: { applyFrom: 'today' } });
        invalidateHabitsPreferencesCache();
      }

      setShowAddForm(false);
      setFormData({ ...EMPTY_FORM, section: targetSection });
      if (targetSection !== currentSection) {
        setCurrentSection(targetSection);
      }
      await fetchHabits();
      await fetchHabitsConfig();
      setSelectedHabitId(habitId);
    } catch {
      // manejado en contexto
    }
  };

  const handleDelete = async (habitId) => {
    if (!window.confirm('?Est?s seguro de que deseas eliminar este h?bito?')) return;
    try {
      await deleteHabit(habitId, currentSection);
      setSelectedHabitId(null);
      await fetchHabitsConfig();
    } catch {
      // manejado en contexto
    }
  };

  const handleReorder = async (habitIds) => {
    try {
      await reorderHabits(currentSection, habitIds);
    } catch {
      // manejado en contexto
    }
  };

  const detailMode = showAddForm ? 'create' : (selectedHabit ? 'edit' : 'empty');

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '100vh' : '90vh',
        },
      }}
    >
      <TareaFormHeader onClose={onClose} closeLabel="Cerrar">
        <Typography variant="h6" sx={{ fontWeight: 400, fontSize: '1.25rem', pr: 4 }}>
          Personalizar mi rutina
        </Typography>
      </TareaFormHeader>

      <HabitsManagerSectionTabs
        sections={sections}
        currentSection={currentSection}
        onSectionChange={handleSectionChange}
        showAddForm={showAddForm}
        onAddClick={handleAddClick}
      />

      <DialogContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          p: 0,
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: { xs: '100%', md: '35%' },
              minWidth: { md: 220 },
              maxWidth: { md: 280 },
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              flex: { xs: '0 0 auto', md: 'none' },
              borderRight: { md: 1 },
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <HabitsManagerList
              habits={sortedHabits}
              habitsConfig={habitsConfig}
              currentSection={currentSection}
              selectedHabitId={showAddForm ? null : selectedHabitId}
              loading={loading}
              sectionLabel={sectionLabel}
              isMobile={isMobile}
              listExpanded={mobileListExpanded}
              onToggleListExpanded={setMobileListExpanded}
              showAddForm={showAddForm}
              onSelect={(id) => {
                if (isEditDirty && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
                  return;
                }
                editDraftHabitIdRef.current = null;
                setShowAddForm(false);
                setSelectedHabitId(id);
                const habit = sortedHabits.find((h) => h.id === id);
                if (habit && !habitsConfig[currentSection]?.[id]) {
                  const defaultConfig = getDefaultHabitConfig(habit);
                  setHabitsConfig((prev) => ({
                    ...prev,
                    [currentSection]: {
                      ...(prev[currentSection] || {}),
                      [id]: defaultConfig,
                    },
                  }));
                }
              }}
              onReorder={handleReorder}
              onAddClick={handleAddClick}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <HabitsManagerDetail
              mode={detailMode}
              habit={selectedHabit}
              editDraft={editDraft}
              formData={formData}
              errors={errors}
              habitsConfig={habitsConfig}
              currentSection={currentSection}
              sectionOptions={sections}
              onCreateSection={sectionSelectProps.onCreate}
              createSectionLabel={sectionSelectProps.createLabel}
              loading={loading}
              saving={isSavingEdit}
              isDirty={isEditDirty}
              canDelete={sortedHabits.length > 1}
              onFormChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
              onDraftChange={(patch) => setEditDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
              onSectionChange={(section) => setFormData((prev) => ({ ...prev, section }))}
              onConfigChange={(newConfig) => {
                if (showAddForm) {
                  setFormData((prev) => ({ ...prev, config: newConfig }));
                } else if (editDraft) {
                  setEditDraft((prev) => (prev ? { ...prev, config: normalizeManagerConfig(newConfig) } : prev));
                }
              }}
              onSaveCreate={handleSaveCreate}
              onCancelCreate={handleCancelCreate}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDelete={handleDelete}
              onAddClick={handleAddClick}
            />
          </Box>
        </Box>
      </DialogContent>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: { xs: 'none', md: 'flex' },
          justifyContent: 'flex-end',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          flexShrink: 0,
        }}
      >
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none' }}>
          Cerrar
        </Button>
      </Box>
    </Dialog>
    <HabitGroupFormDialog {...groupDialogProps} />
    </>
  );
};
