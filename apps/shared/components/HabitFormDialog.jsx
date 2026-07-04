import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {

  Dialog,

  DialogContent,

  Box,

  Typography,

  Button,

} from '@mui/material';

import { useHabits, useRutinas } from '@shared/context';

import clienteAxios from '@shared/config/axios';

import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';

import { useResponsive, useHabitSectionCreateOption } from '@shared/hooks';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';

import {

  tareaFormDialogPaperSx,

  TareaFormHeader,

  TareaFormFooter,

  HabitFormTitleField,

  TASK_FORM_HORIZONTAL_PX,

} from '@shared/components/forms/tareaFormUi';

import HabitFormFields from '@shared/components/habits/HabitFormFields.jsx';

import { DEFAULT_HABIT_CONFIG, normalizeHabitConfig, saveHabitFromForm } from '@shared/habits/form';

import { normalizeTimeOfDay } from '@shared/utils/timeOfDayUtils';



const DEFAULT_ICON = DEFAULT_HABIT_ICON;



const HabitFormDialog = ({ open, onClose, editingHabit = null, editingSection = null, initialDraft = null }) => {

  const { isMobile } = useResponsive();

  const { habits, customSections, addHabit, updateHabit, deleteHabit, fetchHabits } = useHabits();
  const { sectionOptions, sectionSelectProps, groupDialogProps } = useHabitSectionCreateOption({
    onSectionCreated: (sectionId) => setFormData((prev) => ({ ...prev, section: sectionId })),
  });

  const { updateUserHabitPreference, rutina } = useRutinas();



  const [formData, setFormData] = useState({

    label: '',

    section: 'bodyCare',

    icon: DEFAULT_ICON,

  });



  const [config, setConfig] = useState(DEFAULT_HABIT_CONFIG);

  const [errors, setErrors] = useState({});

  const [isSaving, setIsSaving] = useState(false);



  useEffect(() => {

    if (!open) return;



    if (editingHabit && editingSection) {

      setFormData({

        label: editingHabit.label || '',

        section: editingSection,

        icon: editingHabit.icon || DEFAULT_ICON,

      });



      const habitId = editingHabit.id || editingHabit._id;

      const habitConfig = habitId ? rutina?.config?.[editingSection]?.[habitId] : null;

      setConfig(normalizeHabitConfig(habitConfig || DEFAULT_HABIT_CONFIG));

    } else {

      setFormData({

        label: initialDraft?.label || '',

        section: initialDraft?.section || 'bodyCare',

        icon: DEFAULT_ICON,

      });

      setConfig({ ...DEFAULT_HABIT_CONFIG });

    }

    setErrors({});

  }, [open, editingHabit, editingSection, initialDraft, rutina]);



  const validateForm = () => {

    const newErrors = {};

    if (!formData.label?.trim()) {

      newErrors.label = 'El nombre es requerido';

    }

    if (!formData.section) {

      newErrors.section = 'Debe seleccionar un grupo';

    }

    if (!formData.icon) {

      newErrors.icon = 'Debe seleccionar un icono';

    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;

  };



  const handleSave = async () => {

    if (!validateForm()) return;



    setIsSaving(true);

    try {

      let habitId;



      if (editingHabit && editingSection) {

        habitId = editingHabit.id || editingHabit._id;



        await updateHabit(habitId, editingSection, {

          label: formData.label.trim(),

          icon: formData.icon,

          activo: editingHabit.activo !== undefined ? editingHabit.activo : true,

        });



        if (formData.section !== editingSection) {

          const currentConfig = rutina?.config?.[editingSection]?.[habitId];

          await clienteAxios.delete(`/api/users/habits/${habitId}`, {

            data: { section: editingSection },

          });

          const orden = habits[formData.section]?.length || 0;

          await addHabit(formData.section, {

            id: habitId,

            label: formData.label.trim(),

            icon: formData.icon,

            activo: editingHabit.activo !== undefined ? editingHabit.activo : true,

            orden,

          });

          if (currentConfig && updateUserHabitPreference) {

            await updateUserHabitPreference(formData.section, habitId, currentConfig, true);

          }

        }



        const normalizedConfig = normalizeHabitConfig(config);

        if (updateUserHabitPreference) {

          await updateUserHabitPreference(formData.section, habitId, normalizedConfig, true);

        }

      } else {

        await saveHabitFromForm({

          label: formData.label,

          section: formData.section,

          icon: formData.icon,

          config,

          habits,

          addHabit,

          updateUserHabitPreference,

          fetchHabits,

        });

      }



      if (editingHabit) {

        await fetchHabits();

      }

      onClose();

    } catch (error) {

      console.error('[HabitFormDialog] Error al guardar hábito:', error);

      setErrors({

        submit: error.message || 'Error al guardar el hábito. Por favor, intenta nuevamente.',

      });

    } finally {

      setIsSaving(false);

    }

  };



  const handleConfigChange = useCallback((newConfig) => {

    setConfig((prev) => ({

      ...prev,

      ...newConfig,

      horarios: normalizeTimeOfDay(

        newConfig.horarios !== undefined ? newConfig.horarios : prev.horarios,

      ),

    }));

  }, []);

  const isEditing = Boolean(editingHabit && editingSection);
  const sectionHabitCount = (habits[editingSection] || []).length;
  const canDelete = isEditing && sectionHabitCount > 1;

  const handleDelete = async () => {
    if (!isEditing) return;

    const habitId = editingHabit.id || editingHabit._id;
    const habitLabel = (formData.label || editingHabit.label || 'este hábito').trim();

    if (!window.confirm(`¿Eliminar el hábito "${habitLabel}"?`)) return;

    setIsSaving(true);
    try {
      await deleteHabit(habitId, editingSection);
      await fetchHabits();
      onClose();
    } catch (error) {
      console.error('[HabitFormDialog] Error al eliminar hábito:', error);
      setErrors({
        submit: error.response?.data?.error || error.message || 'Error al eliminar el hábito',
      });
    } finally {
      setIsSaving(false);
    }
  };



  return (

    <>

    <Dialog

      open={open}

      onClose={onClose}

      maxWidth="sm"

      fullWidth

      fullScreen={isMobile}

      PaperProps={{

        sx: {

          ...tareaFormDialogPaperSx(isMobile),

          display: 'flex',

          flexDirection: 'column',

        },

      }}

    >

      <DialogContent sx={{ flex: 1, overflowY: 'auto', py: 0, px: 0 }}>

        <TareaFormHeader onClose={onClose}>

          <Box sx={{ px: TASK_FORM_HORIZONTAL_PX, pt: 0.5, pb: 0.5 }}>

            <HabitFormTitleField

              value={formData.label}

              onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}

              icon={formData.icon}

              onIconChange={(icon) => setFormData((prev) => ({ ...prev, icon }))}

              placeholder="Nombre del hábito"

              error={!!errors.label}

              iconError={!!errors.icon}

              helperText={errors.label}

              autoFocus

              showSection

              section={formData.section}

              onSectionChange={(section) => setFormData((prev) => ({ ...prev, section }))}

              sectionOptions={sectionOptions}

              sectionError={errors.section}

              onCreateSection={sectionSelectProps.onCreate}

              createSectionLabel={sectionSelectProps.createLabel}

            />

          </Box>

        </TareaFormHeader>



        <Box sx={{ px: TASK_FORM_HORIZONTAL_PX, pb: 1 }}>

          <HabitFormFields

            section={formData.section}

            onSectionChange={(section) => setFormData((prev) => ({ ...prev, section }))}

            icon={formData.icon}

            onIconChange={(icon) => setFormData((prev) => ({ ...prev, icon }))}

            config={config}

            onConfigChange={handleConfigChange}

            errors={errors}

            showSection={false}

            showIconPicker={false}

            showCadence

            sectionOptions={sectionOptions}

            onCreateSection={sectionSelectProps.onCreate}

            createSectionLabel={sectionSelectProps.createLabel}

          />



          {errors.submit && (

            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>

              {errors.submit}

            </Typography>

          )}

        </Box>



        <TareaFormFooter

          onSave={handleSave}

          saving={isSaving}

          saveLabel={isSaving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Agregar hábito')}

          leftAction={isEditing ? (
            <Button
              color="error"
              size="small"
              onClick={handleDelete}
              disabled={!canDelete || isSaving}
              sx={{ textTransform: 'none' }}
            >
              Eliminar hábito
            </Button>
          ) : null}

        />

      </DialogContent>

    </Dialog>

    <HabitGroupFormDialog {...groupDialogProps} />

    </>

  );

};



export default HabitFormDialog;

