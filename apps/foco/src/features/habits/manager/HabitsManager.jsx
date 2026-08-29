import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, Box, Divider, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useResponsive, useHabitSectionCreateOption, useHabitRoutineCreateOption, useRoutineAssignment } from '@shared/hooks';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import HabitRoutineFormDialog from '@shared/components/habits/HabitRoutineFormDialog';
import { useHabits, useRutinas } from '@shared/context';
import clienteAxios from '@shared/config/axios';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
  TASK_FORM_HORIZONTAL_PX,
  TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
} from '@shared/components/forms/tareaFormUi';
import { generateHabitId } from '@shared/habits/form';
import { invalidateHabitsPreferencesCache, updateHabitChainsOnApi } from '@shared/hooks/useHabitsPreferences';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import { normalizeHabitStep, removeHabitFromChains, resolveSectionIconKey, updateHabitChainLabel, generateChainId, isGroupedRoutineChain } from '@shared/habits';
import { NEW_HABIT_CHAIN_VALUE, createNewRoutineAssignment, applyChainFormSave } from '@shared/habits/routines';
import { Z_INDEX } from '@shared/config/uiConstants';
import { DEFAULT_HABIT_CONFIG } from '@shared/habits/form';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import {
  getDefaultHabitConfig,
  getHabitConfig,
  normalizeManagerConfig,
} from '@shared/habits/form/habitsManagerUtils';
import HabitsManagerList from './components/HabitsManagerList';
import HabitsManagerDetail from './components/HabitsManagerDetail';
import HabitsManagerSidebarHeader from './components/HabitsManagerSidebarHeader';
import HabitsManagerRoutinesList from './components/HabitsManagerRoutinesList';
import HabitsManagerRoutineDetail from './components/HabitsManagerRoutineDetail';
import HabitsManagerCreateDialog from './components/HabitsManagerCreateDialog';
import HabitsManagerActionFooter from './components/HabitsManagerActionFooter';

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
  const [mobileRoutineListExpanded, setMobileRoutineListExpanded] = useState(false);
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

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

  const { sectionOptions: sections, sectionSelectProps, groupDialogProps, openEditGroupDialog } = useHabitSectionCreateOption({
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

  const sortedHabits = useMemo(
    () => [...(habits[selectedHabitSection] || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [habits, selectedHabitSection],
  );

  const routineChains = useMemo(
    () => (habitChains || []).filter(isGroupedRoutineChain),
    [habitChains],
  );

  const selectedChain = useMemo(
    () => routineChains.find((chain) => chain.id === selectedChainId) || null,
    [routineChains, selectedChainId],
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
        const habitList = Array.isArray(sectionHabits)
          ? sectionHabits
          : (sectionHabits && typeof sectionHabits === 'object'
            ? Object.values(sectionHabits)
            : []);

        habitList.forEach((habit) => {
          if (!habit?.id) return;
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
        setMobileRoutineListExpanded(false);
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
    const chain = routineChains.find((entry) => entry.id === selectedChainId);
    if (!chain) return;
    setRoutineDraft({
      label: chain.label || '',
      steps: (chain.steps || []).map(normalizeHabitStep).filter(Boolean),
    });
  }, [managerMode, selectedChainId, routineChains, routineSessionKey]);

  useEffect(() => {
    if (managerMode !== 'routines') return;
    if (selectedChainId && routineChains.some((chain) => chain.id === selectedChainId)) return;
    setSelectedChainId(routineChains[0]?.id || null);
  }, [managerMode, routineChains, selectedChainId]);

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
      onClose();
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
    onClose,
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
    setMobileListExpanded(false);
    setMobileRoutineListExpanded(false);
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
            ? { ...chain, label: trimmedLabel, steps }
            : chain
        ))
        .filter((chain) => Array.isArray(chain.steps) && chain.steps.length >= 2);
      await updateHabitChainsOnApi(nextChains);
      bumpRoutineSession();
      onClose();
    } catch {
      // manejado arriba
    } finally {
      setIsSavingRoutine(false);
    }
  }, [selectedChain, routineDraft, habitChains, bumpRoutineSession, onClose]);

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

  const handleOpenCreateDialog = useCallback(() => {
    const hasUnsaved = managerMode === 'routines' ? isRoutineDirty : isEditDirty;
    if (hasUnsaved && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
      return;
    }
    if (showAddForm) {
      setShowAddForm(false);
      setErrors({});
    }
    setCreateDialogOpen(true);
  }, [managerMode, isRoutineDirty, isEditDirty, showAddForm]);

  useEffect(() => {
    const handleHeaderAddButtonClick = (event) => {
      if (event.detail?.type === 'habit') {
        handleOpenCreateDialog();
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAddButtonClick);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAddButtonClick);
  }, [handleOpenCreateDialog]);

  const handleCreateDialogSave = useCallback(async ({ type, label, icon, section }) => {
    setIsSavingCreate(true);
    try {
      if (type === 'routines') {
        if (!prefsReady) return;
        const newId = generateChainId();
        const nextChains = [
          ...(habitChains || []),
          { id: newId, label, steps: [] },
        ];
        await updateHabitChainsOnApi(nextChains);
        setManagerMode('routines');
        setSelectedChainId(newId);
        bumpRoutineSession();
      } else {
        const targetSection = section || expandedSection || currentSection;
        let habitId = generateHabitId(label);
        let counter = 1;
        const baseId = habitId;
        while (habits[targetSection]?.some((h) => h.id === habitId)) {
          habitId = `${baseId}${counter}`;
          counter += 1;
        }

        const orden = habits[targetSection]?.length || 0;
        await addHabit(targetSection, {
          id: habitId,
          label,
          icon,
          activo: true,
          orden,
        });

        const defaultConfig = normalizeManagerConfig(DEFAULT_HABIT_CONFIG);

        if (updateUserHabitPreference) {
          await updateUserHabitPreference(targetSection, habitId, defaultConfig, true);
        } else {
          await clienteAxios.put('/api/users/preferences/habits', {
            habits: { [targetSection]: { [habitId]: defaultConfig } },
            applyFrom: 'today',
          }, { params: { applyFrom: 'today' } });
          invalidateHabitsPreferencesCache();
        }

        setManagerMode('habits');
        setCurrentSection(targetSection);
        setExpandedSection(targetSection);
        setSelectedHabitId(habitId);
        bumpEditSession();
      }

      setCreateDialogOpen(false);
      await fetchHabits();
      await fetchHabitsConfig();
    } catch {
      // manejado en contexto / API
    } finally {
      setIsSavingCreate(false);
    }
  }, [
    prefsReady,
    habitChains,
    bumpRoutineSession,
    habits,
    expandedSection,
    currentSection,
    addHabit,
    updateUserHabitPreference,
    bumpEditSession,
    fetchHabits,
    fetchHabitsConfig,
  ]);

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
      onClose();
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

  const handleReorderRoutines = useCallback(async (orderedChainIds) => {
    if (!orderedChainIds?.length || !prefsReady) return;
    const visibleSet = new Set(orderedChainIds);
    const chainById = Object.fromEntries((habitChains || []).map((chain) => [chain.id, chain]));
    const reorderedVisible = orderedChainIds.map((id) => chainById[id]).filter(Boolean);
    let visibleIndex = 0;
    const nextChains = (habitChains || []).map((chain) => {
      if (!visibleSet.has(chain.id)) return chain;
      const next = reorderedVisible[visibleIndex];
      visibleIndex += 1;
      return next;
    });
    try {
      await updateHabitChainsOnApi(nextChains);
      bumpRoutineSession();
    } catch {
      // manejado en contexto
    }
  }, [habitChains, prefsReady, bumpRoutineSession]);

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

  const {
    openCreateRoutineDialog,
    openEditRoutineDialog,
    routineDialogProps,
  } = useHabitRoutineCreateOption({
    onRoutineCreated: async ({ label }) => {
      const trimmedLabel = (label || '').trim();
      if (!trimmedLabel || !prefsReady) return;

      const nextConfig = {
        ...createNewRoutineAssignment(),
        label: trimmedLabel,
      };
      routineAssignment.setConfig(nextConfig);

      const section = activeRoutineSection;
      const habitId = showAddForm ? null : selectedHabit?.id;
      if (!habitId || !section) return;

      const nextChains = applyChainFormSave(habitChains, section, habitId, nextConfig);
      const created = nextChains.find(
        (chain) => chain.label === trimmedLabel
          && (chain.steps || []).some(
            (step) => step.section === section && step.habitId === habitId,
          ),
      );

      await updateHabitChainsOnApi(nextChains);

      if (created) {
        routineAssignment.setConfig({
          enabled: true,
          chainId: created.id,
          label: created.label || trimmedLabel,
          linkedSteps: [],
        });
      }
    },
    onRoutineEdited: async ({ label }) => {
      const current = routineAssignment.config;
      const nextConfig = { ...current, label };
      routineAssignment.setConfig(nextConfig);
      if (current.chainId && current.chainId !== NEW_HABIT_CHAIN_VALUE) {
        await handleRoutineRenameSave(label, nextConfig);
      }
    },
  });

  const detailMode = managerMode === 'routines'
    ? (selectedChain ? 'edit' : 'empty')
    : (showAddForm ? 'create' : (selectedHabit ? 'edit' : 'empty'));

  const mobilePickerExpanded = managerMode === 'habits' ? mobileListExpanded : mobileRoutineListExpanded;
  const showMobileHabitsChange = isMobile && managerMode === 'habits' && !showAddForm && sortedHabits.length > 0;
  const showMobileRoutinesChange = isMobile && managerMode === 'routines' && routineChains.length > 0;

  const handleMobilePickerToggle = useCallback(() => {
    if (managerMode === 'habits') {
      setMobileListExpanded((prev) => !prev);
      return;
    }
    setMobileRoutineListExpanded((prev) => !prev);
  }, [managerMode]);

  const footerSaveActive = useMemo(() => {
    if (detailMode === 'empty') return false;
    if (managerMode === 'habits') {
      if (detailMode === 'create') return Boolean((formData?.label || '').trim());
      return isEditDirty;
    }
    const steps = (routineDraft?.steps || []).map(normalizeHabitStep).filter(Boolean);
    return isRoutineDirty
      && Boolean((routineDraft?.label || '').trim())
      && steps.length >= 2;
  }, [
    detailMode,
    managerMode,
    formData?.label,
    isEditDirty,
    routineDraft,
    isRoutineDirty,
  ]);

  const renderActionFooter = () => (
    <HabitsManagerActionFooter
      managerMode={managerMode}
      detailMode={detailMode}
      saving={managerMode === 'habits' ? isSavingEdit : isSavingRoutine}
      saveActive={footerSaveActive}
      canDelete={managerMode === 'habits' ? sortedHabits.length > 1 : routineChains.length > 1}
      onSave={managerMode === 'habits'
        ? (detailMode === 'create' ? handleSaveCreate : handleSaveEdit)
        : handleSaveRoutine}
      onDelete={managerMode === 'habits'
        ? () => handleDelete(selectedHabit?.id)
        : () => handleDeleteRoutine(selectedChainId)}
      deleteAriaLabel={managerMode === 'habits' ? 'Eliminar hábito' : 'Eliminar rutina'}
    />
  );

  const renderModeHeader = () => (
    <HabitsManagerSidebarHeader
      mode={managerMode}
      onChange={handleManagerModeChange}
      disabled={loading}
      onAddClick={handleOpenCreateDialog}
      edge="top"
    />
  );

  const renderSelectorList = () => (
    managerMode === 'habits' ? (
      <HabitsManagerList
        sections={sections}
        allHabits={habits}
        habitChains={habitChains}
        expandedSection={expandedSection}
        onSectionExpand={handleSectionExpand}
        selectedHabitId={showAddForm ? null : selectedHabitId}
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
        onAddClick={handleOpenCreateDialog}
      />
    ) : (
      <HabitsManagerRoutinesList
        habitChains={habitChains}
        habits={habits}
        selectedChainId={selectedChainId}
        loading={loading}
        isMobile={isMobile}
        listExpanded={mobileRoutineListExpanded}
        onToggleListExpanded={setMobileRoutineListExpanded}
        onSelect={(chainId) => {
          if (isRoutineDirty && !window.confirm('Tienes cambios sin guardar. ?Descartarlos?')) {
            return;
          }
          bumpRoutineSession();
          setRoutineErrors({});
          setSelectedChainId(chainId);
        }}
        onReorder={handleReorderRoutines}
      />
    )
  );

  const renderSidebar = () => (
    <>
      {renderModeHeader()}
      {renderSelectorList()}
    </>
  );

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
        {isMobile ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              px: TASK_FORM_HORIZONTAL_PX,
              pt: 'max(8px, env(safe-area-inset-top, 0px))',
              pb: 0.75,
              minHeight: (theme) => (
                `calc(${TASK_FORM_HEADER_ACTION_COLUMN_WIDTH}px + ${theme.spacing(0.75)} + max(8px, env(safe-area-inset-top, 0px)))`
              ),
            }}
          >
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Cerrar"
              sx={{
                width: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
                height: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
                p: 0,
                color: 'text.secondary',
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <TareaFormHeader onClose={onClose} closeLabel="Cerrar" />
        )}

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
          {!isMobile && (
            <Box
              sx={{
                width: '35%',
                minWidth: 220,
                maxWidth: 280,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                borderRight: 1,
                borderColor: 'divider',
                flexShrink: 0,
                bgcolor: 'background.default',
              }}
            >
              {renderSidebar()}
            </Box>
          )}

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
            {isMobile && renderModeHeader()}

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
              onAddClick={handleOpenCreateDialog}
              habits={habits}
              customSections={customSections}
              habitChains={habitChains}
              chainConfig={routineAssignment.config}
              onChainConfigChange={routineAssignment.setConfig}
              onSectionRenameSave={handleSectionRenameSave}
              onSectionEdit={openEditGroupDialog}
              onRoutineRenameSave={handleRoutineRenameSave}
              onCreateRoutine={openCreateRoutineDialog}
              onEditRoutine={openEditRoutineDialog}
              hideFooter
              showMobileChange={showMobileHabitsChange}
              mobilePickerExpanded={mobilePickerExpanded}
              onMobilePickerToggle={handleMobilePickerToggle}
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
              canDelete={routineChains.length > 1}
              onDraftChange={handleRoutineDraftChange}
              onSave={handleSaveRoutine}
              onDelete={handleDeleteRoutine}
              errors={routineErrors}
              hideFooter
              isMobile={isMobile}
              showMobileChange={showMobileRoutinesChange}
              mobilePickerExpanded={mobilePickerExpanded}
              onMobilePickerToggle={handleMobilePickerToggle}
            />
            )}
            </Box>
          </Box>

          {isMobile && (
            <>
              {mobilePickerExpanded && (
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    flex: '0 0 auto',
                    borderTop: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                    bgcolor: 'background.default',
                  }}
                >
                  {renderSelectorList()}
                </Box>
              )}

              {renderActionFooter()}
            </>
          )}
        </Box>
      </DialogContent>

      {!isMobile && renderActionFooter()}
    </Dialog>
    <HabitGroupFormDialog {...groupDialogProps} zIndex={Z_INDEX.modalOverlay + 1} />
    <HabitRoutineFormDialog {...routineDialogProps} zIndex={Z_INDEX.modalOverlay + 1} />
    <HabitsManagerCreateDialog
      open={createDialogOpen}
      onClose={() => setCreateDialogOpen(false)}
      onSave={handleCreateDialogSave}
      saving={isSavingCreate}
      initialType={managerMode}
      defaultSection={expandedSection || currentSection}
      sectionOptions={sections}
      onCreateSection={sectionSelectProps.onCreate}
      createSectionLabel={sectionSelectProps.createLabel}
      zIndex={Z_INDEX.modalOverlay + 1}
    />
    </>
  );
};
