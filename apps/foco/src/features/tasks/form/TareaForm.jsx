import React, { useState, useEffect, Suspense } from 'react';
import {
  TextField,
  Box,
} from '@mui/material';
import {
  TareaFormTipoSelector,
  TAREA_FORM_TIPO_ALL,
  TAREA_FORM_TIPO_EVENTO_TAREA,
  TareaFormHeader,
  TareaFormFooter,
  TareaFormPriorityToggle,
  tareaFormTitleFieldSx,
  TareaFormHeaderTitleRow,
  HabitFormTitleField,
  TAREA_FORM_HEADER_ACTION_GUTTER,
  TareaFormDialogShell,
  TareaFormAttachmentsSection,
  useTareaFormAttachments,
} from '@shared/components/forms/tareaFormUi';
import { useAuth } from '@shared/context/AuthContext';
import TareaFormAdvancedFields from './TareaFormAdvancedFields';
import TareaDelegateDialog from '../components/TareaDelegateDialog';
import TareaFormDetailShell from './components/TareaFormDetailShell';
import HabitFormFields from '@shared/components/habits/HabitFormFields.jsx';
import { saveHabitFromForm } from '@shared/habits/form';
import { useHabitFormState } from '../../habits/manager';
import { useResponsive } from '@shared/hooks';
import { useHabits, useRutinas } from '@shared/context';
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
 * @param {'dialog'|'detail'} shell - Contenedor: diálogo centrado o detalle (drawer / half-screen)
 * @param {string} agendaView - Horizonte ahora|luego (posiciona el panel desktop)
 * @param {boolean} desktopHalfScreen - Panel a mitad de pantalla en desktop
 * @param {boolean} embedded - En desktop, rellena la columna padre en lugar de Dialog
 * @param {Function} actionsToolbar - Toolbar de acciones rápidas (detalle)
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
  updateWithHistory,
  shell = 'dialog',
  agendaView = 'ahora',
  desktopHalfScreen = false,
  embedded = false,
  actionsToolbar,
  onDelegateRequest,
}) => {
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const { habits, addHabit, fetchHabits } = useHabits();
  const { updateUserHabitPreference } = useRutinas();
  const [isObjetivoFormOpen, setIsObjetivoFormOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
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
    owners: [],
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
        subtareas: initialData?.subtareas || [],
        owners: initialData?.owners || [],
        usuario: initialData?.usuario,
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

      if (!formData.googleTasksSync?.enabled) {
        setFormData((prev) => ({
          ...prev,
          googleTasksSync: {
            ...(prev.googleTasksSync || {}),
            enabled: true,
            needsSync: true,
            syncStatus: 'pending',
          },
        }));
        // Persist enable before one-shot sync so export queue picks it up
        await clienteAxios.put(`/api/tareas/${formData._id}`, {
          googleTasksSync: {
            ...(formData.googleTasksSync || {}),
            enabled: true,
            needsSync: true,
            syncStatus: 'pending',
          },
        });
      }
      
      const response = await clienteAxios.post(`/api/google-tasks/sync/task/${formData._id}`);
      const taskSynced = response.data?.success === true;
      
      if (taskSynced) {
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
    setFormData((prev) => {
      const nextEnabled = !prev.googleTasksSync?.enabled;
      return {
        ...prev,
        googleTasksSync: {
          ...(prev.googleTasksSync || {}),
          enabled: nextEnabled,
          needsSync: nextEnabled ? true : Boolean(prev.googleTasksSync?.needsSync),
          syncStatus: nextEnabled ? 'pending' : (prev.googleTasksSync?.syncStatus || 'synced'),
        },
      };
    });
  };

  const isDetailShell = shell === 'detail';
  const Shell = isDetailShell ? TareaFormDetailShell : TareaFormDialogShell;
  const hasTools = typeof actionsToolbar === 'function';
  const footerOutside = isDetailShell;

  const toolsSlot = hasTools
    ? actionsToolbar({
      onAttach: handleFileChange,
      canGoogleSync: Boolean(isEditing && formData._id && !isHabitMode),
      handleSyncToGoogle,
      syncingToGoogle,
      googleTasksSync: formData.googleTasksSync,
    })
    : null;

  const footerEl = (
    <TareaFormFooter
      onSave={handleSubmit}
      saving={saving}
      saveLabel={isEditing ? 'Actualizar' : 'Guardar'}
      showCancel={footerOutside}
      onCancel={footerOutside ? onClose : undefined}
      cancelLabel="Cerrar"
    />
  );

  return (
    <Shell
      open={open}
      onClose={onClose}
      isMobile={isMobile}
      {...(isDetailShell
        ? { agendaView, desktopHalfScreen, embedded, footer: footerEl }
        : {})}
    >
        <TareaFormHeader onClose={footerOutside ? undefined : onClose}>
          {hasTools && !isHabitMode && (
            <Box sx={{ mb: 1.25 }}>
              {toolsSlot}
            </Box>
          )}

          {canSelectHabit && (
            <TareaFormTipoSelector
              value={formData.tipo || 'TAREA'}
              options={TAREA_FORM_TIPO_ALL}
              onChange={(v) => {
                setFormData((prev) => ({ ...prev, tipo: v }));
                if (v !== 'HABITO') setErrors({});
              }}
              sx={{
                mb: isHabitMode ? 1 : 1.5,
                pr: footerOutside ? 0 : TAREA_FORM_HEADER_ACTION_GUTTER,
              }}
            />
          )}

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
          <Box sx={{ position: 'relative', ...(!canSelectHabit ? { pt: 1.35 } : null) }}>
            {!canSelectHabit && (
              <TareaFormTipoSelector
                value={formData.tipo || 'TAREA'}
                options={TAREA_FORM_TIPO_EVENTO_TAREA}
                readOnly
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 1,
                }}
              />
            )}
            <TareaFormHeaderTitleRow
              action={
                !hasTools && formData.tipo !== 'EVENTO' ? (
                  <TareaFormPriorityToggle
                    prioridad={formData.prioridad}
                    onChange={(value) => setFormData((prev) => ({ ...prev, prioridad: value }))}
                  />
                ) : null
              }
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
          </Box>
          )}
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
          currentUserId={user?.id || user?._id}
          onDelegateRequest={onDelegateRequest || (() => setDelegateOpen(true))}
          showGoogleSyncToggle
          onToggleGoogleSync={handleToggleGoogleSync}
        />
        )}

          {!isHabitMode && (
            <TareaFormAttachmentsSection
              archivos={formData.archivos}
              onRemove={removeFile}
            />
          )}
        </Box>

        {!footerOutside && footerEl}

      <Suspense fallback={null}>
        <ObjetivoForm
          open={isObjetivoFormOpen}
          onClose={() => setIsObjetivoFormOpen(false)}
          onSubmit={handleObjetivosubmit}
          isEditing={false}
        />
      </Suspense>

      {!onDelegateRequest ? (
        <TareaDelegateDialog
          open={delegateOpen}
          onClose={() => setDelegateOpen(false)}
          onSelect={(userSelected) => {
            const id = String(userSelected._id || userSelected.id);
            setFormData((prev) => {
              const existing = (prev.owners || []).map((o) => String(o?._id || o?.id || o));
              if (existing.includes(id)) return prev;
              return {
                ...prev,
                owners: [...(prev.owners || []), userSelected],
              };
            });
          }}
          excludeIds={[
            user?.id || user?._id,
            formData.usuario?._id || formData.usuario,
            ...(formData.owners || []).map((o) => o?._id || o?.id || o),
          ].filter(Boolean)}
        />
      ) : null}
    </Shell>
  );
};

export default TareaForm;
