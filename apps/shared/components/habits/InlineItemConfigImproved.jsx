import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import {

  Box,

  Typography,

  TextField,

  IconButton,

  Divider,

  Chip,

} from '@mui/material';

import CheckIcon from '@mui/icons-material/Check';

import { styled } from '@mui/material/styles';

import './InlineItemConfigImproved.css';

import { CancelarTabButton, GuardarTabButton } from '@shared/components/common/SystemButtons';

import { getTimeOfDayLabels, normalizeTimeOfDay, VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';

import { DIAS_SEMANA } from '@shared/habits';

import { HABIT_PERIODIC_COPY } from '@shared/copy/agendaTerminology';



const normalizeFrecuencia = (value) => {

  const parsed = parseInt(String(value || '1'), 10);

  return Number(isNaN(parsed) ? 1 : Math.max(1, parsed));

};



const getDiaSemanaLetra = (diaValue) => {

  const letras = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };

  return letras[diaValue] || '';

};



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

      handleConfigChange({ horarios: [...currentHorarios, horario].sort() });

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

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', mb: 0.3 }} />

      <Box sx={{ display: 'flex', flexDirection: 'row', minHeight: 22 }}>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.04, mr: 0.1, minWidth: 22 }}>

          {tipoOptions.map((option, idx) => (

            <React.Fragment key={option.value}>

              <Box

                onClick={() => handleConfigChange({ tipo: option.value })}

                sx={{

                  cursor: 'pointer',

                  px: 0.2,

                  py: 0.08,

                  fontWeight: 600,

                  fontSize: '0.78em',

                  color: configState.tipo === option.value ? '#fff' : 'rgba(255,255,255,0.5)',

                  background: configState.tipo === option.value ? 'rgba(255,255,255,0.08)' : 'none',

                  borderLeft: configState.tipo === option.value ? '3px solid #1976d2' : '3px solid transparent',

                  '&:hover': { background: 'rgba(255,255,255,0.12)', color: '#fff' },

                }}

              >

                {option.label}

              </Box>

              {idx < tipoOptions.length - 1 && (

                <Divider orientation="horizontal" flexItem sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.08)' }} />

              )}

            </React.Fragment>

          ))}

        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.3, borderColor: 'rgba(255,255,255,0.08)' }} />

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'wrap', minWidth: 0, justifyContent: 'center', py: 0.12 }}>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.12 }}>

                <IconButton size="small" onClick={() => handleConfigChange({ frecuencia: Math.max(1, configState.frecuencia - 1) })} sx={{ width: 18, height: 18, fontSize: '0.95rem' }}>-</IconButton>

                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', minWidth: 24, textAlign: 'center', fontSize: '1.1rem' }}>{configState.frecuencia}</Typography>

                <IconButton size="small" onClick={() => handleConfigChange({ frecuencia: Math.max(1, configState.frecuencia + 1) })} sx={{ width: 18, height: 18, fontSize: '0.95rem' }}>+</IconButton>

              </Box>

            </Box>

            {configState.tipo === 'PERSONALIZADO' && (

              <TextField

                select

                size="small"

                value={configState.periodo}

                onChange={(e) => handleConfigChange({ periodo: e.target.value })}

                SelectProps={{ native: true }}

                sx={{ minWidth: 140, '& select': { color: '#fff' } }}

              >

                {periodoOptions.map((option) => (

                  <option key={option.value} value={option.value}>{option.label}</option>

                ))}

              </TextField>

            )}

          </Box>

          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.8, flexWrap: 'wrap', justifyContent: 'center' }}>

            {VALID_TIME_OF_DAY.map((horario) => {

              const currentHorarios = configState.horarios || [];

              const isChecked = currentHorarios.includes(horario);

              const isDisabled = !isChecked && currentHorarios.length >= maxHorarios;

              const label = horario === 'MAÑANA' ? 'Mañana' : horario === 'TARDE' ? 'Tarde' : 'Noche';

              return (

                <Chip

                  key={horario}

                  label={label}

                  onClick={() => !isDisabled && handleHorarioToggle(horario)}

                  disabled={isDisabled}

                  size="small"

                />

              );

            })}

          </Box>

          {(configState.tipo === 'SEMANAL' || (configState.tipo === 'PERSONALIZADO' && configState.periodo === 'CADA_SEMANA')) && (

            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>

              {[...DIAS_SEMANA.slice(1), DIAS_SEMANA[0]].map((dia) => {

                const isChecked = (configState.diasSemana || []).includes(dia.value);

                return (

                  <Chip key={dia.value} label={getDiaSemanaLetra(dia.value)} onClick={() => handleDiaSemanaToggle(dia.value)} size="small" color={isChecked ? 'primary' : 'default'} variant={isChecked ? 'filled' : 'outlined'} />

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


