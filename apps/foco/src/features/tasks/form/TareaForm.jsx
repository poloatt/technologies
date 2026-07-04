import React, { useState, useEffect, Suspense } from 'react';
import {
  Button,
  TextField,
  Box,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  TareaFormTipoSelector,
  TAREA_FORM_TIPO_ALL,
  TAREA_FORM_TIPO_EVENTO_TAREA,
  TareaFormHeader,
  TareaFormFooter,
  TareaFormPriorityToggle,
  tareaFormTitleFieldSx,
  tareaFormPillTextSx,
  TAREA_FORM_CHEVRON_ICON_SIZE,
  TareaFormHeaderTitleRow,
  HabitFormTitleField,
  TAREA_FORM_HEADER_ACTION_GUTTER,
  TareaFormDialogShell,
  TareaFormAttachmentsSection,
  useTareaFormAttachments,
} from '@shared/components/forms/tareaFormUi';
import TareaFormAdvancedFields from './TareaFormAdvancedFields';
import HabitFormFields from '@shared/components/habits/HabitFormFields.jsx';
import { saveHabitFromForm } from '@shared/habits/form';
import { useHabitFormState } from '../../habits/templates/useHabitFormState';
import { useResponsive } from '@shared/hooks';
import { useHabits, useRutinas } from '@shared/context';
import {
  Google as GoogleIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import clienteAxios from '@shared/config/axios';
import {
  cleanDescriptionForForm,
  resolveTareaFormRrule,
} from './tareaRecurrenceFormUtils';

const ObjetivoForm = React.lazy(() => import('../../objetivos/ObjetivoForm'));

/**
 * Componente de formulario para crear/editar tareas
 * 
 * @param {boolean} open - Controla si el diálogo está abierto
 * @param {Function} onClose - Función para cerrar el diálogo
 * @param {Function} onSubmit - Función que se llama al enviar el formulario (requerida)
 * @param {Object} initialData - Datos iniciales para edición (opcional)
 * @param {boolean} isEditing - Indica si se está editando una tarea existente
 * @param {string} objetivoId - ID del objetivo si se está creando desde un objetivo específico (opcional)
 * @param {Array} objetivos - Lista de objetivos disponibles (opcional)
 * @param {Function} onObjetivosUpdate - Función para actualizar la lista de objetivos (opcional)
 * @param {Function} updateWithHistory - Función para actualizar tareas con historial (opcional)
 *   Solo se usa para actualizar subtareas dentro del formulario cuando la tarea ya está guardada.
 *   Si no se proporciona, las actualizaciones de subtareas solo funcionarán para subtareas nuevas (sin _id).
 */
const TareaForm = ({ 
  open, 
  onClose, 
  onSubmit, 
  initialData = null, 
  isEditing,
  objetivoId,
  objetivos,
  onObjetivosUpdate,
  updateWithHistory
}) => {
  const { isMobile } = useResponsive();
  const { habits, addHabit, fetchHabits } = useHabits();
  const { updateUserHabitPreference } = useRutinas();
  const [isObjetivoFormOpen, setIsObjetivoFormOpen] = useState(false);
  const {
    habitSection,
    setHabitSection,
    habitIcon,
    habitConfig,
    handleConfigChange,
    handleIconChange,
    validateHabitForm,
    resetHabitForm,
  } = useHabitFormState();
  const [saving, setSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  
  const initialFormState = {
    titulo: '',
    descripcion: '',
    estado: 'PENDIENTE',
    fechaInicio: new Date(),
    fechaFin: null,
    fechaVencimiento: null,
    prioridad: 'BAJA',
    archivos: [],
    objetivo: null,
    completada: false,
    subtareas: [],
    tipo: 'TAREA',
    rrule: null,
  };

  const [formData, setFormData] = useState(() => ({
    ...initialFormState,
    ...initialData,
    tipo: initialData?.tipo === 'EVENTO' ? 'EVENTO' : 'TAREA',
    fechaInicio: initialData?.fechaInicio ? new Date(initialData.fechaInicio) : new Date(),
    fechaFin: initialData?.fechaFin ? new Date(initialData.fechaFin) : null,
    fechaVencimiento: initialData?.fechaVencimiento ? new Date(initialData.fechaVencimiento) : null,
    objetivo: objetivoId || (initialData?.objetivo?._id || initialData?.objetivo) || null,
    estado: initialData?.estado || 'PENDIENTE',
    googleTasksSync: initialData?.googleTasksSync || { enabled: false }
  }));

  const [errors, setErrors] = useState({});
  const [syncingToGoogle, setSyncingToGoogle] = useState(false);
  const { handleFileChange, removeFile } = useTareaFormAttachments(setFormData);

  const isHabitMode = formData.tipo === 'HABITO';
  const canSelectHabit = !isEditing && !initialData?._id;

  useEffect(() => {
    if (open) {
      setFormData({
        ...initialFormState,
        ...initialData,
        descripcion: cleanDescriptionForForm(initialData?.descripcion),
        rrule: resolveTareaFormRrule(initialData),
        tipo: initialData?.tipo === 'EVENTO' ? 'EVENTO' : 'TAREA',
        fechaInicio: initialData?.fechaInicio ? new Date(initialData.fechaInicio) : new Date(),
        fechaFin: initialData?.fechaFin ? new Date(initialData.fechaFin) : null,
        fechaVencimiento: initialData?.fechaVencimiento ? new Date(initialData.fechaVencimiento) : null,
        objetivo: objetivoId || (initialData?.objetivo?._id || initialData?.objetivo) || null,
        estado: initialData?.estado || 'PENDIENTE',
        subtareas: initialData?.subtareas || []
      });
      resetHabitForm();
      setErrors({});
    }
  }, [initialData, open, objetivoId]);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleToggleSubtarea = async (index) => {
    try {
      const subtarea = formData.subtareas[index];
      
      // Si la subtarea es nueva (no tiene _id), solo actualizamos el estado local
      if (!subtarea._id) {
        setFormData(prev => ({
          ...prev,
          subtareas: prev.subtareas.map((st, i) => 
            i === index ? { ...st, completada: !st.completada } : st
          )
        }));
        return;
      }

      // Validar que la tarea esté guardada y que updateWithHistory esté disponible
      if (!formData._id) {
        enqueueSnackbar('Guarda la tarea primero antes de actualizar subtareas', { variant: 'warning' });
        return;
      }

      if (!updateWithHistory) {
        enqueueSnackbar('Función de actualización no disponible', { variant: 'error' });
        return;
      }

      // Guardar el estado original
      const tareaOriginal = { ...formData };
      
      // Preparar las subtareas actualizadas
      const subtareasActualizadas = formData.subtareas.map((st, i) => 
        i === index ? { ...st, completada: !st.completada } : st
      );
      
      // Determinar nuevo estado basado en subtareas
      const todasCompletadas = subtareasActualizadas.every(st => st.completada);
      const algunaCompletada = subtareasActualizadas.some(st => st.completada);
      let nuevoEstado = 'PENDIENTE';
      if (todasCompletadas) {
        nuevoEstado = 'COMPLETADA';
      } else if (algunaCompletada) {
        nuevoEstado = 'EN_PROGRESO';
      }
      
      // Preparar actualización incluyendo estado y completada cuando corresponda
      const updateData = {
        subtareas: subtareasActualizadas,
        estado: nuevoEstado
      };
      
      // Si todas las subtareas están completadas, marcar la tarea como completada
      if (todasCompletadas) {
        updateData.completada = true;
      } else {
        updateData.completada = false;
      }
      
      const response = await updateWithHistory(formData._id, updateData, tareaOriginal);

      // Actualizamos el estado local con los datos del servidor
      if (response) {
        setFormData(prev => ({
          ...prev,
          subtareas: response.subtareas || subtareasActualizadas,
          estado: response.estado || nuevoEstado,
          completada: response.completada !== undefined ? response.completada : (todasCompletadas ? true : false)
        }));
        enqueueSnackbar('Subtarea actualizada exitosamente', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error al actualizar subtarea:', error);
      enqueueSnackbar('Error al actualizar subtarea', { variant: 'error' });
    }
  };

  const handleSubmit = async () => {
    if (isHabitMode) {
      if (!validateHabitForm(formData.titulo, errors, setErrors)) return;
      setSaving(true);
      try {
        await saveHabitFromForm({
          label: formData.titulo,
          section: habitSection,
          icon: habitIcon,
          config: habitConfig,
          habits,
          addHabit,
          updateUserHabitPreference,
          fetchHabits,
        });
        enqueueSnackbar('Hábito creado', { variant: 'success' });
        onClose();
      } catch (error) {
        enqueueSnackbar(error.message || 'Error al crear el hábito', { variant: 'error' });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (validateForm()) {
      try {
        // Si no hay objetivoId, significa que estamos en la vista de tareas
        // y necesitamos un objetivo seleccionado
        const isEvento = formData.tipo === 'EVENTO';
        if (!isEvento && !objetivoId && !formData.objetivo) {
          setErrors(prev => ({
            ...prev,
            objetivo: 'El objetivo es requerido'
          }));
          return;
        }

        const formDataToSubmit = {
          ...formData,
          tipo: isEvento ? 'EVENTO' : 'TAREA',
          fechaInicio: formData.fechaInicio ? (formData.fechaInicio instanceof Date ? formData.fechaInicio.toISOString() : formData.fechaInicio) : new Date().toISOString(),
          fechaVencimiento: formData.fechaVencimiento ? (formData.fechaVencimiento instanceof Date ? formData.fechaVencimiento.toISOString() : formData.fechaVencimiento) : null,
          fechaFin: formData.fechaFin ? (formData.fechaFin instanceof Date ? formData.fechaFin.toISOString() : formData.fechaFin) : null,
          objetivo: isEvento ? (objetivoId || formData.objetivo || null) : (objetivoId || formData.objetivo),
          rrule: formData.rrule || null,
        };

        onSubmit(formDataToSubmit);
        onClose();
      } catch (error) {
        console.error('Error al preparar datos:', error);
        setErrors(prev => ({
          ...prev,
          submit: error.message || 'Error al preparar los datos del formulario'
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.titulo) {
      newErrors.titulo = 'El título es requerido';
    }
    if (!formData.estado) {
      newErrors.estado = 'El estado es requerido';
    }
    if (!formData.fechaInicio) {
      newErrors.fechaInicio = 'La fecha de inicio es requerida';
    }
    if (formData.fechaFin && formData.fechaInicio > formData.fechaFin) {
      newErrors.fechaFin = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }
    
    const isEvento = formData.tipo === 'EVENTO';
    if (!isEvento && !objetivoId && !formData.objetivo) {
      newErrors.objetivo = 'El objetivo es requerido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleObjetivosubmit = async (objetivoData) => {
    try {
      const response = await clienteAxios.post('/api/objetivos', objetivoData);
      const nuevoobjetivo = response.data;
      
      // Actualizar el campo de objetivo en el formulario
      setFormData((prev) => ({
        ...prev,
        objetivo: nuevoobjetivo._id || nuevoobjetivo.id,
        googleTasksSync: {
          ...(prev.googleTasksSync || {}),
          ...(nuevoobjetivo.googleTasksSync?.googleTaskListId
            ? { googleTaskListId: nuevoobjetivo.googleTasksSync.googleTaskListId }
            : {}),
        },
      }));
      
      // Cerrar el formulario de objetivo
      setIsObjetivoFormOpen(false);
      
      // Actualizar la lista de Objetivos
      if (onObjetivosUpdate) {
        await onObjetivosUpdate();
      }
      
      enqueueSnackbar('objetivo creado exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error al crear objetivo:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Error al crear el objetivo', 
        { variant: 'error' }
      );
    }
  };

  const handleSyncToGoogle = async () => {
    if (!formData._id) {
      enqueueSnackbar('Guarda la tarea primero antes de sincronizar', { variant: 'warning' });
      return;
    }

    try {
      setSyncingToGoogle(true);
      
      const response = await clienteAxios.post(`/api/google-tasks/sync/task/${formData._id}`);
      const taskSynced = response.data?.success === true;
      
      if (taskSynced) {
        // Actualizar el estado local con la información de sincronización
        setFormData(prev => ({
          ...prev,
          googleTasksSync: {
            ...prev.googleTasksSync,
            enabled: true,
            syncStatus: 'synced',
            lastSyncDate: new Date()
          }
        }));
        
        enqueueSnackbar('Tarea sincronizada con Google Tasks exitosamente', { variant: 'success' });
      } else {
        enqueueSnackbar('La tarea no pudo ser sincronizada. Verifica la configuración.', { variant: 'warning' });
      }
    } catch (error) {
      console.error('Error al sincronizar con Google Tasks:', error);
      const errorMessage = error.response?.data?.error || 'Error al sincronizar con Google Tasks';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSyncingToGoogle(false);
    }
  };

  const handleToggleGoogleSync = () => {
    setFormData(prev => ({
      ...prev,
      googleTasksSync: {
        ...prev.googleTasksSync,
        enabled: !prev.googleTasksSync.enabled
      }
    }));
  };

  return (
    <TareaFormDialogShell open={open} onClose={onClose} isMobile={isMobile}>
        <TareaFormHeader onClose={onClose}>
          <TareaFormTipoSelector
            value={formData.tipo || 'TAREA'}
            options={canSelectHabit ? TAREA_FORM_TIPO_ALL : TAREA_FORM_TIPO_EVENTO_TAREA}
            readOnly={!canSelectHabit}
            onChange={(v) => {
              setFormData((prev) => ({ ...prev, tipo: v }));
              if (v !== 'HABITO') setErrors({});
            }}
            sx={{ mb: 1.5, pr: TAREA_FORM_HEADER_ACTION_GUTTER }}
          />

          {isHabitMode ? (
            <HabitFormTitleField
              value={formData.titulo}
              onChange={handleChange('titulo')}
              icon={habitIcon}
              onIconChange={(name) => handleIconChange(name, (field) => setErrors((e) => ({ ...e, [field]: undefined })))}
              placeholder="Nombre del hábito"
              error={!!errors.titulo}
              iconError={!!errors.icon}
              helperText={errors.titulo}
              required
              autoFocus
            />
          ) : (
          <TareaFormHeaderTitleRow
            action={formData.tipo !== 'EVENTO' ? (
              <TareaFormPriorityToggle
                prioridad={formData.prioridad}
                onChange={(value) => setFormData((prev) => ({ ...prev, prioridad: value }))}
              />
            ) : null}
          >
            <TextField
              variant="standard"
              fullWidth
              placeholder="Agregar título"
              value={formData.titulo}
              onChange={handleChange('titulo')}
              error={!!errors.titulo}
              helperText={errors.titulo}
              required
              autoFocus
              sx={{ flex: 1, minWidth: 0, ...tareaFormTitleFieldSx }}
            />
          </TareaFormHeaderTitleRow>
          )}

          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {isEditing && formData._id && !isHabitMode && (
              <Tooltip
                title={
                  formData.googleTasksSync?.enabled
                    ? (formData.googleTasksSync?.googleTaskId
                      ? 'Sincronizado con Google Tasks'
                      : 'Sincronizar con Google Tasks')
                    : 'Habilitar sincronización con Google Tasks'
                }
              >
                <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="text"
                  startIcon={
                    syncingToGoogle ? (
                      <SyncIcon className="animate-spin" sx={{ fontSize: TAREA_FORM_CHEVRON_ICON_SIZE }} />
                    ) : (
                      <GoogleIcon
                        sx={{
                          fontSize: TAREA_FORM_CHEVRON_ICON_SIZE,
                          color: formData.googleTasksSync?.googleTaskId
                            ? 'success.main'
                            : 'text.secondary',
                        }}
                      />
                    )
                  }
                  size="small"
                  onClick={handleSyncToGoogle}
                  disabled={syncingToGoogle}
                  sx={{
                    color: formData.googleTasksSync?.googleTaskId
                      ? 'success.main'
                      : 'text.secondary',
                    textTransform: 'none',
                    ...tareaFormPillTextSx,
                    minWidth: 'auto',
                    px: 0.5,
                  }}
                >
                  {syncingToGoogle ? 'Sincronizando...' : 'Google'}
                </Button>
                </span>
              </Tooltip>
            )}
          </Stack>
        </TareaFormHeader>

        <Box sx={{ px: 2 }}>
        {isHabitMode ? (
          <HabitFormFields
            section={habitSection}
            onSectionChange={setHabitSection}
            icon={habitIcon}
            onIconChange={(name) => handleIconChange(name, (field) => setErrors((e) => ({ ...e, [field]: undefined })))}
            config={habitConfig}
            onConfigChange={handleConfigChange}
            errors={errors}
            showSection
            showIconPicker={false}
            showCadence
          />
        ) : (
        <TareaFormAdvancedFields
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          objetivos={objetivos}
          objetivoId={objetivoId}
          showFechaInicio
          showSubtareas
          onCreateObjetivo={() => setIsObjetivoFormOpen(true)}
          onToggleSubtarea={handleToggleSubtarea}
          onAttach={handleFileChange}
        />
        )}

          {!isHabitMode && (
            <TareaFormAttachmentsSection
              archivos={formData.archivos}
              onRemove={removeFile}
            />
          )}
        </Box>

        <TareaFormFooter
          onSave={handleSubmit}
          saving={saving}
          saveLabel={isEditing ? 'Actualizar' : 'Guardar'}
        />

      <Suspense fallback={null}>
        <ObjetivoForm
          open={isObjetivoFormOpen}
          onClose={() => setIsObjetivoFormOpen(false)}
          onSubmit={handleObjetivosubmit}
          isEditing={false}
        />
      </Suspense>
    </TareaFormDialogShell>
  );
};

export default TareaForm;
