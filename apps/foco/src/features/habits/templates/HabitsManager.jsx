import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, Box, Button, Divider } from '@mui/material';
import { useResponsive, useHabitSectionCreateOption, useRoutineAssignment } from '@shared/hooks';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import { useHabits, useRutinas } from '@shared/context';
import clienteAxios from '@shared/config/axios';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
} from '@shared/components/forms/tareaFormUi';
import { generateHabitId } from '@shared/habits/form';
import { invalidateHabitsPreferencesCache, updateHabitChainsOnApi } from '@shared/hooks/useHabitsPreferences';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { normalizeHabitStep, removeHabitFromChains, resolveSectionIconKey, updateHabitChainLabel } from '@shared/habits';
import { NEW_HABIT_CHAIN_VALUE } from '@shared/habits/routines';
import { Z_INDEX } from '@shared/config/uiConstants';
import { DEFAULT_HABIT_CONFIG } from '@shared/habits/form';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import {
  getDefaultHabitConfig,
  getHabitConfig,
  normalizeManagerConfig,
} from '@shared/habits/form/habitsManagerUtils';
import HabitsManagerList from './HabitsManagerList';
import HabitsManagerDetail from './HabitsManagerDetail';
import HabitsManagerSidebarHeader from './HabitsManagerSidebarHeader';
import HabitsManagerRoutinesList from './HabitsManagerRoutinesList';
import HabitsManagerRoutineDetail from './HabitsManagerRoutineDetail';

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
    customSections,
    updateHabitSection,
  } = useHabits();
  const { habitChains, prefsReady } = useHabitsPreferences();
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
  const [managerMode, setManagerMode] = useState('habits');
  const [expandedSection, setExpandedSection] = useState('bodyCare');
  const habitsRef = useRef(habits);
  const editDraftHabitIdRef = useRef(null);
  const [editSessionKey, setEditSessionKey] = useState(0);
  const [selectedChainId, setSelectedChainId] = useState(null);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [routineErrors, setRoutineErrors] = useState({});
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [routineSessionKey, setRoutineSessionKey] = useState(0);

  const resetManagerState = useCallback(() => {
    setShowAddForm(false);
    setSelectedHabitId(null);
    setEditDraft(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setIsSavingEdit(false);
    setSelectedChainId(null);
    setRoutineDraft(null);
    setRoutineErrors({});
    setIsSavingRoutine(false);
    editDraftHabitIdRef.current = null;
  }, []);

  const bumpEditSession = useCallback(() => {
    setEditSessionKey((key) => key + 1);
  }, []);

  const bumpRoutineSession = useCallback(() => {
    setRoutineSessionKey((key) => key + 1);
  }, []);

  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const handleSectionCreated = useCallback((sectionId) => {
    setCurrentSection(sectionId);
    setExpandedSection(sectionId);
    setFormData((prev) => ({ ...prev, section: sectionId }));
    setEditDraft((prev) => (prev ? { ...prev, section: sectionId } : prev));
  }, []);

  const { sectionOptions: sections, sectionSelectProps, groupDialogProps } = useHabitSectionCreateOption({
    onSectionCreated: handleSectionCreated,
  });

  const sectionLabel = sections.find((s) => s.value === currentSection)?.label || currentSection;

  const selectedHabit = useMemo(() => {
    if (!selectedHabitId) return null;
    for (const section of sections) {
      const habit = (habits[section.value] || []).find((entry) => entry.id === selectedHabitId);
      if (habit) return habit;
    }
    return null;
  }, [habits, sections, selectedHabitId]);

  const selectedHabitSection = useMemo(() => {
    if (!selectedHabitId) return currentSection;
    for (const section of sections) {
      if ((habits[section.value] || []).some((entry) => entry.id === selectedHabitId)) {
        return section.value;
      }
    }
    return currentSection;
  }, [habits, sections, selectedHabitId, currentSection]);

  const selectedSectionLabel = sections.find((s) => s.value === selectedHabitSection)?.label
    || selectedHabitSection;

  const sortedHabits = useMemo(
    () => [...(habits[selectedHabitSection] || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [habits, selectedHabitSection],
  );

  const stackChains = useMemo(
    () => (habitChains || []).filter(
      (chain) => chain?.type === 'stack'
        && Array.isArray(chain.steps)
        && chain.steps.length >= 2,
    ),
    [habitChains],
  );

  const selectedChain = useMemo(
    () => stackChains.find((chain) => chain.id === selectedChainId) || null,
    [stackChains, selectedChainId],
  );

  const activeRoutineSection = showAddForm
    ? (formData.section || currentSection)
    : selectedHabitSection;

  const routineAssignment = useRoutineAssignment({
    habitChains,
    prefsReady,
    section: activeRoutineSection,
    habitId: showAddForm ? null : selectedHabit?.id,
    active: open,
    mode: showAddForm ? 'create' : 'edit',
  });

  const fetchHabitsConfig = useCallback(async () => {
    try {
      const response = await clienteAxios.get('/api/users/preferences/habits');
      const loadedConfig = response.data?.habits || {};
      const initializedConfig = { ...loadedConfig };

      Object.entries(habitsRef.current || {}).forEach(([sectionId, sectionHabits]) => {
        (sectionHabits || []).forEach((habit) => {
          if (!initializedConfig[sectionId]) {
            initializedConfig[sectionId] = {};
          }
          if (!initializedConfig[sectionId][habit.id]) {
            initializedConfig[sectionId][habit.id] = getDefaultHabitConfig(habit);
          }
        });
      });

      setHabitsConfig(initializedConfig);
    } catch (error) {
      console.error('[HabitsManager] Error al cargar configuraci?n:', error);
      setHabitsConfig({});
    }
  }, []);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        resetManagerState();
        setMobileListExpanded(false);
        setManagerMode('habits');
      }
      wasOpenRef.current = false;
      return undefined;
    }

    if (wasOpenRef.current) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      invalidateHabitsPreferencesCache();
      await fetchHabits();
      await fetchHabitsConfig();
      if (cancelled) return;
      setExpandedSection(currentSection);
      bumpEditSession();
    })();

    wasOpenRef.current = true;

    return () => {
      cancelled = true;
    };
  }, [open, fetchHabits, fetchHabitsConfig, bumpEditSession, resetManagerState, currentSection]);

  useEffect(() => {
    if (!open || showAddForm || !selectedHabitId) {
      setEditDraft(null);
      editDraftHabitIdRef.current = null;
      return;
    }

    const habit = (habits[selectedHabitSection] || []).find((h) => h.id === selectedHabitId);
    if (!habit) return;

    const config = getHabitConfig(habitsConfig, selectedHabitSection, habit.id, habit);
    setEditDraft({
      label: habit.label,
      icon: habit.icon,
      section: selectedHabitSection,
      config: normalizeManagerConfig(config),
    });
    editDraftHabitIdRef.current = selectedHabitId;
  }, [
    open,
    showAddForm,
    selectedHabitId,
    selectedHabitSection,
    habits,
    habitsConfig,
    editSessionKey,
  ]);

  const resetRoutineAssignment = routineAssignment.reset;

  useEffect(() => {
    if (!open || showAddForm || !selectedHabitId) return;
    resetRoutineAssignment();
  }, [editSessionKey, open, showAddForm, selectedHabitId, resetRoutineAssignment]);

  const handleDraftChange = useCallback((patch) => {
    if (patch.section) {
      setCurrentSection(patch.section);
      setExpandedSection(patch.section);
    }
    setEditDraft((prev) => {
      if (prev) return { ...prev, ...patch };
      const habit = sortedHabits.find((h) => h.id === selectedHabitId);
      if (!habit) return prev;
      const config = normalizeManagerConfig(
        getHabitConfig(habitsConfig, selectedHabitSection, habit.id, habit),
      );
      return {
        label: habit.label,
        icon: habit.icon,
        section: selectedHabitSection,
        config,
        ...patch,
      };
    });
  }, [sortedHabits, selectedHabitId, habitsConfig, selectedHabitSection]);

  const isEditDirty = useMemo(() => {
    if (!editDraft || !selectedHabit) return false;
    const savedConfig = normalizeManagerConfig(
      getHabitConfig(habitsConfig, selectedHabitSection, selectedHabit.id, selectedHabit),
    );
    return (
      editDraft.label !== selectedHabit.label
      || editDraft.icon !== selectedHabit.icon
      || editDraft.section !== selectedHabitSection
      || JSON.stringify(editDraft.config) !== JSON.stringify(savedConfig)
      || routineAssignment.isDirty
    );
  }, [editDraft, selectedHabit, habitsConfig, selectedHabitSection, routineAssignment.isDirty]);

  const isRoutineDirty = useMemo(() => {
    if (!routineDraft || !selectedChain) return false;
    const savedSteps = (selectedChain.steps || []).map(normalizeHabitStep).filter(Boolean);
    const draftSteps = (routineDraft.steps || []).map(normalizeHabitStep).filter(Boolean);
    return (routineDraft.label || '').trim() !== (selectedChain.label || '').trim()
      || JSON.stringify(draftSteps) !== JSON.stringify(savedSteps);
  }, [routineDraft, selectedChain]);

  useEffect(() => {
    if (managerMode !== 'routines' || !selectedChainId) {
      setRoutineDraft(null);
      return;
    }
    const chain = stackChains.find((entry) => entry.id === selectedChainId);
    if (!chain) return;
    setRoutineDraft({
      label: chain.label || '',
      steps: (chain.steps || []).map(normalizeHabitStep).filter(Boolean),
    });
  }, [managerMode, selectedChainId, stackChains, routineSessionKey]);

  useEffect(() => {
    if (managerMode !== 'routines') return;
    if (selectedChainId && stackChains.some((chain) => chain.id === selectedChainId)) return;
    setSelectedChainId(stackChains[0]?.id || null);
  }, [managerMode, stackChains, selectedChainId]);

  useEffect(() => {
    if (!open || showAddForm || managerMode !== 'habits') return;

    if (selectedHabitId) {
      const stillExists = sections.some(
        (section) => (habits[section.value] || []).some((habit) => habit.id === selectedHabitId),
      );
      if (stillExists) {
        if (currentSection !== selectedHabitSection) {
          setCurrentSection(selectedHabitSection);
        }
        return;
      }
      setSelectedHabitId(null);
    }

    const sectionToTry = expandedSection || currentSection;
    const sectionHabits = [...(habits[sectionToTry] || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    if (sectionHabits.length > 0) {
      setSelectedHabitId(sectionHabits[0].id);
      setCurrentSection(sectionToTry);
      return;
    }

    for (const section of sections) {
      const list = [...(habits[section.value] || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      if (list.length > 0) {
        setSelectedHabitId(list[0].id);
        setCurrentSection(section.value);
        setExpandedSection(section.value);
        return;
      }
    }
  }, [open, sortedHabits, selectedHabitId, showAddForm, managerMode, habits, sections, expandedSection, currentSection, selectedHabitSection]);

  const resetEditDraft = useCallback(() => {
    bumpEditSession();
  }, [bumpEditSession]);

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
    const chainError = routineAssignment.validate();
    if (chainError) {
      setErrors({ chain: chainError });
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

      await routineAssignment.persist(targetSection, habitId);

      await fetchHabits();
      await fetchHabitsConfig();
      bumpEditSession();
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
    bumpEditSession,
    routineAssignment,
  ]);

  const handleSectionExpand = useCallback((sectionId) => {
    setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
  }, []);

  const handleManagerModeChange = useCallback((nextMode) => {
    if (nextMode === managerMode) return;
    const hasUnsaved = nextMode === 'routines' ? isEditDirty : isRoutineDirty;
    if (hasUnsaved && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
      return;
    }
    setManagerMode(nextMode);
    setErrors({});
    setRoutineErrors({});
    if (nextMode === 'routines') {
      setShowAddForm(false);
      bumpRoutineSession();
    } else {
      setSelectedChainId(null);
      bumpEditSession();
    }
  }, [managerMode, isEditDirty, isRoutineDirty, bumpEditSession, bumpRoutineSession]);

  const handleRoutineDraftChange = useCallback((patch) => {
    setRoutineDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.label !== undefined && routineErrors.label) {
      setRoutineErrors((prev) => ({ ...prev, label: undefined }));
    }
    if (patch.steps !== undefined && routineErrors.steps) {
      setRoutineErrors((prev) => ({ ...prev, steps: undefined }));
    }
  }, [routineErrors]);

  const handleSaveRoutine = useCallback(async () => {
    if (!selectedChain || !routineDraft) return;
    const trimmedLabel = (routineDraft.label || '').trim();
    const steps = (routineDraft.steps || []).map(normalizeHabitStep).filter(Boolean);
    const nextErrors = {};
    if (!trimmedLabel) nextErrors.label = 'El nombre es requerido';
    if (steps.length < 2) nextErrors.steps = 'Selecciona al menos 2 hábitos';
    if (Object.keys(nextErrors).length > 0) {
      setRoutineErrors(nextErrors);
      return;
    }
    setRoutineErrors({});
    try {
      setIsSavingRoutine(true);
      const nextChains = (habitChains || [])
        .map((chain) => (
          chain.id === selectedChain.id
            ? { ...chain, label: trimmedLabel, steps, type: 'stack' }
            : chain
        ))
        .filter((chain) => Array.isArray(chain.steps) && chain.steps.length >= 2);
      await updateHabitChainsOnApi(nextChains);
      bumpRoutineSession();
    } catch {
      // manejado arriba
    } finally {
      setIsSavingRoutine(false);
    }
  }, [selectedChain, routineDraft, habitChains, bumpRoutineSession]);

  const handleDeleteRoutine = useCallback(async (chainId) => {
    if (!window.confirm('?Est?s seguro de que deseas eliminar esta rutina?')) return;
    try {
      const nextChains = (habitChains || []).filter((chain) => chain.id !== chainId);
      await updateHabitChainsOnApi(nextChains);
      setSelectedChainId(null);
      bumpRoutineSession();
    } catch {
      // manejado arriba
    }
  }, [habitChains, bumpRoutineSession]);

  const handleAddClick = () => {
    if (isEditDirty && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
      return;
    }
    bumpEditSession();
    setShowAddForm(true);
    setSelectedHabitId(null);
    setEditDraft(null);
    editDraftHabitIdRef.current = null;
    setFormData({ ...EMPTY_FORM, section: expandedSection || currentSection, config: { ...DEFAULT_HABIT_CONFIG } });
    setErrors({});
    routineAssignment.reset();
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
    const chainError = routineAssignment.validate();
    if (chainError) {
      newErrors.chain = chainError;
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

      await routineAssignment.persist(targetSection, habitId);

      setShowAddForm(false);
      setFormData({ ...EMPTY_FORM, section: targetSection });
      if (targetSection !== currentSection) {
        setCurrentSection(targetSection);
      }
      await fetchHabits();
      await fetchHabitsConfig();
      setSelectedHabitId(habitId);
      bumpEditSession();
    } catch {
      // manejado en contexto
    }
  };

  const handleDelete = async (habitId) => {
    if (!window.confirm('?Est?s seguro de que deseas eliminar este h?bito?')) return;
    try {
      await deleteHabit(habitId, currentSection);
      if (prefsReady) {
        const nextChains = removeHabitFromChains(habitChains, currentSection, habitId);
        await updateHabitChainsOnApi(nextChains);
      }
      setSelectedHabitId(null);
      await fetchHabitsConfig();
    } catch {
      // manejado en contexto
    }
  };

  const handleReorder = async (sectionId, habitIds) => {
    try {
      await reorderHabits(sectionId, habitIds);
    } catch {
      // manejado en contexto
    }
  };

  const handleSectionRenameSave = useCallback(async (sectionId, label) => {
    const icon = resolveSectionIconKey(sectionId, customSections);
    await updateHabitSection(sectionId, { label, icon });
  }, [customSections, updateHabitSection]);

  const handleRoutineRenameSave = useCallback(async (label, currentConfig) => {
    const chainId = currentConfig?.chainId;
    if (chainId && chainId !== NEW_HABIT_CHAIN_VALUE && prefsReady) {
      const nextChains = updateHabitChainLabel(habitChains, chainId, label);
      await updateHabitChainsOnApi(nextChains);
    }
  }, [habitChains, prefsReady]);

  const detailMode = managerMode === 'routines'
    ? (selectedChain ? 'edit' : 'empty')
    : (showAddForm ? 'create' : (selectedHabit ? 'edit' : 'empty'));

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      scroll="body"
      sx={{ zIndex: Z_INDEX.modalOverlay }}
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '100vh' : '90vh',
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.default',
        }}
      >
        <TareaFormHeader onClose={onClose} closeLabel="Cerrar" />

        <Divider />
      </Box>

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
            <HabitsManagerSidebarHeader
              mode={managerMode}
              onChange={handleManagerModeChange}
              disabled={loading}
            />
            {managerMode === 'habits' ? (
            <HabitsManagerList
              sections={sections}
              allHabits={habits}
              habitChains={habitChains}
              expandedSection={expandedSection}
              onSectionExpand={handleSectionExpand}
              selectedHabitId={showAddForm ? null : selectedHabitId}
              selectedSectionLabel={selectedSectionLabel}
              loading={loading}
              isMobile={isMobile}
              listExpanded={mobileListExpanded}
              onToggleListExpanded={setMobileListExpanded}
              showAddForm={showAddForm}
              onSelect={(id, sectionId) => {
                if (isEditDirty && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
                  return;
                }
                bumpEditSession();
                setShowAddForm(false);
                setErrors({});
                setCurrentSection(sectionId);
                setExpandedSection(sectionId);
                setSelectedHabitId(id);
                const habit = (habits[sectionId] || []).find((h) => h.id === id);
                if (habit && !habitsConfig[sectionId]?.[id]) {
                  const defaultConfig = getDefaultHabitConfig(habit);
                  setHabitsConfig((prev) => ({
                    ...prev,
                    [sectionId]: {
                      ...(prev[sectionId] || {}),
                      [id]: defaultConfig,
                    },
                  }));
                }
              }}
              onReorder={handleReorder}
              onAddClick={handleAddClick}
            />
            ) : (
            <HabitsManagerRoutinesList
              habitChains={habitChains}
              habits={habits}
              selectedChainId={selectedChainId}
              loading={loading}
              onSelect={(chainId) => {
                if (isRoutineDirty && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
                  return;
                }
                bumpRoutineSession();
                setRoutineErrors({});
                setSelectedChainId(chainId);
              }}
            />
            )}
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
            {managerMode === 'habits' ? (
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
              onDraftChange={handleDraftChange}
              onSectionChange={(section) => setFormData((prev) => ({ ...prev, section }))}
              onConfigChange={(newConfig) => {
                if (showAddForm) {
                  setFormData((prev) => ({ ...prev, config: newConfig }));
                } else if (editDraft) {
                  setEditDraft((prev) => (prev ? { ...prev, config: normalizeManagerConfig(newConfig) } : prev));
                }
              }}
              onSaveCreate={handleSaveCreate}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDelete}
              onAddClick={handleAddClick}
              habits={habits}
              customSections={customSections}
              habitChains={habitChains}
              chainConfig={routineAssignment.config}
              onChainConfigChange={routineAssignment.setConfig}
              onSectionRenameSave={handleSectionRenameSave}
              onRoutineRenameSave={handleRoutineRenameSave}
            />
            ) : (
            <HabitsManagerRoutineDetail
              chainId={selectedChainId}
              draft={routineDraft}
              habits={habits}
              customSections={customSections}
              loading={loading}
              saving={isSavingRoutine}
              isDirty={isRoutineDirty}
              canDelete={stackChains.length > 1}
              onDraftChange={handleRoutineDraftChange}
              onSave={handleSaveRoutine}
              onDelete={handleDeleteRoutine}
              errors={routineErrors}
            />
            )}
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
    <HabitGroupFormDialog {...groupDialogProps} zIndex={Z_INDEX.modalOverlay + 1} />
    </>
  );
};
