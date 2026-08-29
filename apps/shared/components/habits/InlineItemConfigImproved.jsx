import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { styled } from '@mui/material/styles';
import './InlineItemConfigImproved.css';
import { CancelarTabButton, GuardarTabButton } from '@shared/components/common/SystemButtons';
import { getTimeOfDayLabels, normalizeTimeOfDay, VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { DIAS_SEMANA } from '@shared/habits';
import { HABIT_PERIODIC_COPY } from '@shared/copy/agendaTerminology';
import {
  TASK_FORM_PILL_HEIGHT,
  TASK_FORM_PILL_BORDER_RADIUS,
  TASK_FORM_PILL_GAP,
  TASK_FORM_PILL_OUTLINE_BORDER,
  TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
  TASK_FORM_PILL_OUTLINED_BG,
  TASK_FORM_PILL_OUTLINED_BG_HOVER,
  TASK_FORM_PILL_FILL_BG,
  TASK_FORM_PILL_BORDER_WIDTH,
  taskFormPillTextSx,
} from '@shared/components/forms/tareaFormUi';



const normalizeFrecuencia = (value) => {

  const parsed = parseInt(String(value || '1'), 10);

  return Number(isNaN(parsed) ? 1 : Math.max(1, parsed));

};



const getDiaSemanaLetra = (diaValue) => {
  const letras = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
  return letras[diaValue] || '';
};

function getCadenceToggleSx({ selected = false, disabled = false, circular = false } = {}) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `${TASK_FORM_PILL_BORDER_WIDTH} solid ${selected ? TASK_FORM_PILL_OUTLINE_BORDER_HOVER : TASK_FORM_PILL_OUTLINE_BORDER}`,
    bgcolor: selected ? TASK_FORM_PILL_FILL_BG : TASK_FORM_PILL_OUTLINED_BG,
    color: selected ? 'text.primary' : 'text.secondary',
    fontWeight: selected ? 500 : 400,
    ...taskFormPillTextSx,
    borderRadius: circular ? '50%' : TASK_FORM_PILL_BORDER_RADIUS,
    width: circular ? TASK_FORM_PILL_HEIGHT : 'auto',
    height: TASK_FORM_PILL_HEIGHT,
    minWidth: circular ? TASK_FORM_PILL_HEIGHT : undefined,
    minHeight: TASK_FORM_PILL_HEIGHT,
    px: circular ? 0 : 1.25,
    py: 0,
    m: 0,
    boxSizing: 'border-box',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    flexShrink: 0,
    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    '&:hover:not(:disabled)': {
      bgcolor: selected ? TASK_FORM_PILL_FILL_BG : TASK_FORM_PILL_OUTLINED_BG_HOVER,
      borderColor: TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
      color: 'text.primary',
    },
  };
}

function CadenceCircleToggle({
  label,
  selected = false,
  disabled = false,
  onClick,
  ariaLabel,
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel || label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      sx={getCadenceToggleSx({ selected, disabled, circular: true })}
    >
      {label}
    </Box>
  );
}

function CadencePillToggle({
  label,
  selected = false,
  disabled = false,
  onClick,
  ariaLabel,
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel || label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      sx={getCadenceToggleSx({ selected, disabled, circular: false })}
    >
      {label}
    </Box>
  );
}



/** Ancho mínimo de la columna de tabs en el editor de cadencia/frecuencia. */
export const HABIT_CADENCE_TAB_COLUMN_MIN_WIDTH = 108;

const ConfigContainer = styled(Box)(() => ({
  paddingTop: 0.3,
  paddingBottom: 0.3,
  paddingLeft: 0,
  paddingRight: 0,
  background: 'transparent',
  boxShadow: 'none',
}));



export const getFrecuenciaLabel = (config) => {

  if (!config?.activo) return 'Inactivo';



  const frecuencia = normalizeFrecuencia(config.frecuencia || 1);

  const tipo = (config?.tipo || 'DIARIO').toUpperCase();



  let label = '';

  switch (tipo) {

    case 'DIARIO':

      label = frecuencia === 1 ? 'Diario' : `${frecuencia}x/día`;

      break;

    case 'SEMANAL':

      label = frecuencia === 1 ? 'Semanal' : `${frecuencia}x/sem`;

      break;

    case 'MENSUAL':

      label = frecuencia === 1 ? 'Mensual' : `${frecuencia}x/mes`;

      break;

    case 'PERSONALIZADO': {

      const periodo = config?.periodo || 'CADA_DIA';

      if (periodo === 'CADA_DIA') label = `Cada ${frecuencia}d`;

      else if (periodo === 'CADA_SEMANA') label = `Cada ${frecuencia}s`;

      else if (periodo === 'CADA_MES') label = `Cada ${frecuencia}m`;

      else label = 'Personalizado';

      break;

    }

    default:

      label = 'Diario';

  }



  const periodo = config?.periodo || 'CADA_DIA';

  const showDiasSemana = (tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA'));



  let diasSemanaLabel = '';

  if (showDiasSemana && config?.diasSemana && Array.isArray(config.diasSemana) && config.diasSemana.length > 0) {

    const diasNames = config.diasSemana.map((dia) => getDiaSemanaLetra(dia)).filter(Boolean).join(', ');

    if (diasNames) diasSemanaLabel = `(${diasNames})`;

  }



  const horariosLabel = getTimeOfDayLabels(config?.horarios);

  let finalLabel = label;

  if (diasSemanaLabel) finalLabel = `${label} ${diasSemanaLabel}`;

  if (horariosLabel) finalLabel = `${finalLabel} • ${horariosLabel}`;

  return finalLabel;

};



const InlineItemConfigImproved = ({

  config = {

    tipo: 'DIARIO',

    frecuencia: 1,

    activo: true,

    periodo: 'CADA_DIA',

    horarios: [],

    diasSemana: [],

  },

  onConfigChange,

  itemId,

  sectionId,

  hideActions = false,

  hideTopDivider = false,

}) => {

  const normalizeDiasSemana = (diasSemana) => {

    if (!Array.isArray(diasSemana)) return [];

    return diasSemana.filter((dia) => typeof dia === 'number' && dia >= 0 && dia <= 6);

  };



  const [originalConfig, setOriginalConfig] = useState({

    tipo: (config?.tipo || 'DIARIO').toUpperCase(),

    frecuencia: normalizeFrecuencia(config?.frecuencia),

    activo: config?.activo !== false,

    periodo: config?.periodo || 'CADA_DIA',

    horarios: normalizeTimeOfDay(config?.horarios),

    diasSemana: normalizeDiasSemana(config?.diasSemana),

  });



  const [configState, setConfigState] = useState({ ...originalConfig });

  const [hasChanges, setHasChanges] = useState(false);

  const [isSaving, setIsSaving] = useState(false);



  useEffect(() => {

    const newOriginalConfig = {

      tipo: (config?.tipo || 'DIARIO').toUpperCase(),

      frecuencia: normalizeFrecuencia(config?.frecuencia),

      activo: config?.activo !== false,

      periodo: config?.periodo || 'CADA_DIA',

      horarios: normalizeTimeOfDay(config?.horarios),

      diasSemana: normalizeDiasSemana(config?.diasSemana),

    };

    if (JSON.stringify(newOriginalConfig) !== JSON.stringify(originalConfig) && !hasChanges) {

      setOriginalConfig(newOriginalConfig);

      setConfigState(newOriginalConfig);

    }

  }, [config, hasChanges, originalConfig]);



  const detectChanges = useCallback((newConfig) => {

    const horariosChanged = JSON.stringify(newConfig.horarios || []) !== JSON.stringify(originalConfig.horarios || []);

    const diasSemanaChanged = JSON.stringify(newConfig.diasSemana || []) !== JSON.stringify(originalConfig.diasSemana || []);

    const otherKeysChanged = Object.keys(newConfig).some((key) => {

      if (key === 'horarios' || key === 'diasSemana') return false;

      return newConfig[key] !== originalConfig[key];

    });

    setHasChanges(horariosChanged || diasSemanaChanged || otherKeysChanged);

  }, [originalConfig]);



  const handleConfigChange = (newConfig) => {

    const updatedConfig = { ...configState, ...newConfig };

    if (Object.prototype.hasOwnProperty.call(newConfig, 'tipo')) {

      const tipo = String(newConfig.tipo || 'DIARIO').toUpperCase();

      if (tipo === 'DIARIO') updatedConfig.periodo = 'CADA_DIA';

      if (tipo === 'SEMANAL') updatedConfig.periodo = 'CADA_SEMANA';

      if (tipo === 'MENSUAL') updatedConfig.periodo = 'CADA_MES';

      if (tipo === 'PERSONALIZADO') updatedConfig.periodo = updatedConfig.periodo || 'CADA_DIA';

    }

    if (Object.prototype.hasOwnProperty.call(newConfig, 'frecuencia')) {

      const newFrecuencia = Number(newConfig.frecuencia || 1);

      const currentHorarios = updatedConfig.horarios || [];

      if (currentHorarios.length > newFrecuencia) {

        updatedConfig.horarios = currentHorarios.slice(0, newFrecuencia);

      } else {

        const tipo = String(updatedConfig.tipo || 'DIARIO').toUpperCase();

        const periodo = String(updatedConfig.periodo || 'CADA_DIA').toUpperCase();

        const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');

        if (isDaily && newFrecuencia > 1 && currentHorarios.length < newFrecuencia) {

          const normalized = normalizeTimeOfDay(currentHorarios);

          const remaining = VALID_TIME_OF_DAY.filter((h) => !normalized.includes(h));

          updatedConfig.horarios = [...normalized, ...remaining].slice(0, newFrecuencia);

        }

      }

    }

    setConfigState(updatedConfig);

    detectChanges(updatedConfig);

    if (hideActions && typeof onConfigChange === 'function') onConfigChange(updatedConfig);

  };



  const handleSave = async (scope = 'forward') => {

    if (typeof onConfigChange !== 'function') return;

    setIsSaving(true);

    try {

      await onConfigChange(configState, { scope, sectionId, itemId });

      setHasChanges(false);

      setOriginalConfig(configState);

      setTimeout(() => setIsSaving(false), 1000);

    } catch (error) {

      console.error('Error al guardar configuración:', error);

      setIsSaving(false);

    }

  };



  const handleCancel = () => {

    setConfigState(originalConfig);

    setHasChanges(false);

  };



  const hasRealChanges = useMemo(() => {

    const horariosChanged = JSON.stringify(configState.horarios || []) !== JSON.stringify(originalConfig.horarios || []);

    const diasSemanaChanged = JSON.stringify(configState.diasSemana || []) !== JSON.stringify(originalConfig.diasSemana || []);

    const otherKeysChanged = Object.keys(configState).some((key) => {

      if (key === 'horarios' || key === 'diasSemana') return false;

      return configState[key] !== originalConfig[key];

    });

    return horariosChanged || diasSemanaChanged || otherKeysChanged;

  }, [configState, originalConfig]);



  useEffect(() => {

    if (hasChanges !== hasRealChanges) setHasChanges(hasRealChanges);

  }, [hasChanges, hasRealChanges]);



  const maxHorarios = configState.frecuencia || 1;



  const handleHorarioToggle = (horario) => {

    const currentHorarios = configState.horarios || [];

    const isSelected = currentHorarios.includes(horario);

    if (isSelected) {

      handleConfigChange({ horarios: currentHorarios.filter((h) => h !== horario) });

    } else if (currentHorarios.length < maxHorarios) {

      handleConfigChange({ horarios: normalizeTimeOfDay([...currentHorarios, horario]) });

    }

  };



  const handleDiaSemanaToggle = (diaValue) => {

    const currentDiasSemana = configState.diasSemana || [];

    const isSelected = currentDiasSemana.includes(diaValue);

    if (isSelected) {

      handleConfigChange({ diasSemana: currentDiasSemana.filter((d) => d !== diaValue) });

    } else {

      handleConfigChange({ diasSemana: [...currentDiasSemana, diaValue].sort((a, b) => a - b) });

    }

  };



  const tipoOptions = [

    { value: 'DIARIO', label: 'Diario' },

    { value: 'SEMANAL', label: 'Semanal' },

    { value: 'MENSUAL', label: 'Mensual' },

    { value: 'PERSONALIZADO', label: 'Personalizado' },

  ];



  const periodoOptions = [

    { value: 'CADA_DIA', label: 'día(s)' },

    { value: 'CADA_SEMANA', label: 'semana(s)' },

    { value: 'CADA_MES', label: 'mes(es)' },

  ];



  return (

    <ConfigContainer>

      {!hideTopDivider && <Divider sx={{ mb: 0.3 }} />}

      <Box sx={{ display: 'flex', flexDirection: 'row', minHeight: 22 }}>

        <Tabs
          orientation="vertical"
          value={configState.tipo}
          onChange={(_, value) => handleConfigChange({ tipo: value })}
          sx={{
            flexShrink: 0,
            minWidth: HABIT_CADENCE_TAB_COLUMN_MIN_WIDTH,
            borderRight: 1,
            borderColor: 'divider',
            '& .MuiTabs-indicator': {
              left: 0,
              right: 'auto',
              width: 3,
            },
            '& .MuiTab-root': {
              alignItems: 'flex-start',
              textAlign: 'left',
              minHeight: 36,
              minWidth: HABIT_CADENCE_TAB_COLUMN_MIN_WIDTH,
              py: 0.75,
              px: 1.5,
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'text.primary',
              },
            },
          }}
        >
          {tipoOptions.map((option) => (
            <Tab key={option.value} label={option.label} value={option.value} />
          ))}
        </Tabs>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, pl: 1 }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'wrap', minWidth: 0, justifyContent: 'center', py: 0.12 }}>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: TASK_FORM_PILL_GAP }}>

                <CadenceCircleToggle
                  label="-"
                  ariaLabel="Disminuir frecuencia"
                  onClick={() => handleConfigChange({ frecuencia: Math.max(1, configState.frecuencia - 1) })}
                />

                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', minWidth: 24, textAlign: 'center', fontSize: '1.1rem' }}>{configState.frecuencia}</Typography>

                <CadenceCircleToggle
                  label="+"
                  ariaLabel="Aumentar frecuencia"
                  onClick={() => handleConfigChange({ frecuencia: Math.max(1, configState.frecuencia + 1) })}
                />

              </Box>

            </Box>

            {configState.tipo === 'PERSONALIZADO' && (

              <TextField

                select

                size="small"

                value={configState.periodo}

                onChange={(e) => handleConfigChange({ periodo: e.target.value })}

                SelectProps={{ native: true }}

                sx={{ minWidth: 140, '& select': { color: 'text.primary' } }}

              >

                {periodoOptions.map((option) => (

                  <option key={option.value} value={option.value}>{option.label}</option>

                ))}

              </TextField>

            )}

          </Box>

          <Box sx={{ mt: 0.5, display: 'flex', gap: TASK_FORM_PILL_GAP, flexWrap: 'wrap', justifyContent: 'center' }}>

            {VALID_TIME_OF_DAY.map((horario) => {

              const currentHorarios = configState.horarios || [];

              const isChecked = currentHorarios.includes(horario);

              const isDisabled = !isChecked && currentHorarios.length >= maxHorarios;

              const label = horario === 'MAÑANA' ? 'Mañana' : horario === 'TARDE' ? 'Tarde' : 'Noche';

              return (

                <CadencePillToggle
                  key={horario}
                  label={label}
                  selected={isChecked}
                  disabled={isDisabled}
                  onClick={() => handleHorarioToggle(horario)}
                  ariaLabel={`Franja ${label}`}
                />

              );

            })}

          </Box>

          {(configState.tipo === 'SEMANAL' || (configState.tipo === 'PERSONALIZADO' && configState.periodo === 'CADA_SEMANA')) && (

            <Box sx={{ mt: 0.5, display: 'flex', gap: TASK_FORM_PILL_GAP, flexWrap: 'wrap', justifyContent: 'center' }}>

              {[...DIAS_SEMANA.slice(1), DIAS_SEMANA[0]].map((dia) => {

                const isChecked = (configState.diasSemana || []).includes(dia.value);

                return (

                  <CadenceCircleToggle
                    key={dia.value}
                    label={getDiaSemanaLetra(dia.value)}
                    selected={isChecked}
                    onClick={() => handleDiaSemanaToggle(dia.value)}
                    ariaLabel={dia.label}
                  />

                );

              })}

              {configState.frecuencia > 1 && (!configState.diasSemana || configState.diasSemana.length === 0) && (

                <Typography variant="caption" sx={{ width: '100%', textAlign: 'center', color: 'text.secondary' }}>

                  {HABIT_PERIODIC_COPY.flexibleHint(configState.frecuencia)}

                </Typography>

              )}

            </Box>

          )}

          {!hideActions && hasChanges && (

            <Box sx={{ mt: 0.6, display: 'flex', gap: 1, justifyContent: 'center' }}>

              <CancelarTabButton onClick={handleCancel} disabled={isSaving} />

              <GuardarTabButton onClick={() => handleSave('today')} disabled={isSaving} loading={isSaving} />

            </Box>

          )}

          {!hideActions && !hasChanges && isSaving && (

            <Typography variant="caption" sx={{ mt: 0.6, color: 'success.main', textAlign: 'center' }}>

              <CheckIcon sx={{ fontSize: '1rem', verticalAlign: 'middle' }} /> Configuración guardada

            </Typography>

          )}

        </Box>

      </Box>

    </ConfigContainer>

  );

};



export default InlineItemConfigImproved;


