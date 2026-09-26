import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { EmptyState, SplitScreen } from '@shared/components/common';
import TaskEventBlock from '@shared/components/tasks/TaskEventBlock';
import TareaFormTitleField from '@shared/components/forms/TareaFormTitleField';
import {
  CadenceCircleToggle,
  CadencePillToggle,
  getDiaSemanaLetra,
} from '@shared/components/habits/InlineItemConfigImproved';
import { DIAS_SEMANA } from '@shared/habits';
import useResponsive from '@shared/hooks/useResponsive';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import { MEAL_FRANJAS } from '@shared/pulso';

const WEEK = [...DIAS_SEMANA.slice(1), DIAS_SEMANA[0]];

function mealId(meal) {
  return String(meal?.id || meal?._id || '');
}

function presentMeal(meal) {
  return {
    ...meal,
    nombre: meal?.nombre || '',
    frecuencia: meal?.frecuencia === 'DIARIA' ? 'DIARIA' : 'SEMANAL',
    dias: Array.isArray(meal?.dias) ? meal.dias.map(Number) : [],
    franjas: Array.isArray(meal?.franjas) && meal.franjas.length ? meal.franjas : [],
    porciones: Number(meal?.porciones) || 1,
    ingredientes: Array.isArray(meal?.ingredientes) ? meal.ingredientes : [],
  };
}

function payloadOf(meal) {
  return {
    nombre: meal.nombre.trim() || 'Nueva comida',
    slot: meal.slot || 'COMIDA',
    frecuencia: meal.frecuencia,
    dias: meal.frecuencia === 'SEMANAL' ? meal.dias : [],
    franjas: meal.franjas,
    porciones: Number(meal.porciones) || 1,
    ingredientes: (meal.ingredientes || [])
      .filter((item) => item.nombre && item.nombre.trim())
      .map((item) => ({ nombre: item.nombre.trim() })),
    calorias: Number(meal.calorias) || 0,
    proteinas: Number(meal.proteinas) || 0,
    carbohidratos: Number(meal.carbohidratos) || 0,
    grasas: Number(meal.grasas) || 0,
    preparacion: meal.preparacion || '',
  };
}

export function Nutricion() {
  const { enqueueSnackbar } = useSnackbar();
  const { isDesktop } = useResponsive();
  const [meals, setMeals] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const timers = useRef({});

  const presented = useMemo(() => meals.map(presentMeal), [meals]);

  const loadMeals = useCallback(async () => {
    const response = await clienteAxios.get('/api/dietas/recetas');
    setMeals(response.data || []);
  }, []);

  useEffect(() => {
    loadMeals().catch(() => {
      enqueueSnackbar('Error al cargar Nutrición', { variant: 'error' });
    });
  }, [enqueueSnackbar, loadMeals]);

  useEffect(() => () => {
    Object.values(timers.current).forEach((timer) => clearTimeout(timer));
  }, []);

  const persist = useCallback((meal) => {
    const id = mealId(meal);
    if (!id) return;
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      try {
        await clienteAxios.put(`/api/dietas/recetas/${id}`, payloadOf(meal));
      } catch (error) {
        enqueueSnackbar('Error al guardar la comida', { variant: 'error' });
      }
    }, 400);
  }, [enqueueSnackbar]);

  const updateMeal = (id, next) => {
    setMeals((current) => current.map((meal) => (mealId(meal) === id ? next : meal)));
    persist(next);
  };

  const createMeal = async () => {
    try {
      const response = await clienteAxios.post('/api/dietas/recetas', {
        nombre: 'Nueva comida',
        slot: 'COMIDA',
        frecuencia: 'SEMANAL',
        dias: [],
        franjas: ['TARDE'],
        porciones: 1,
        ingredientes: [],
      });
      const created = response.data;
      setMeals((current) => [created, ...current]);
      setSelectedId(mealId(created));
    } catch (error) {
      enqueueSnackbar('Error al crear la comida', { variant: 'error' });
    }
  };

  const deleteMeal = async (meal) => {
    const id = mealId(meal);
    try {
      await clienteAxios.delete(`/api/dietas/recetas/${id}`);
      setMeals((current) => current.filter((item) => mealId(item) !== id));
      if (selectedId === id) setSelectedId('');
    } catch (error) {
      enqueueSnackbar('Error al eliminar la comida', { variant: 'error' });
    }
  };

  const createMealRef = useRef(createMeal);
  createMealRef.current = createMeal;

  useEffect(() => {
    const onAdd = (event) => {
      if (event.detail?.type === 'nutricion') createMealRef.current();
    };
    window.addEventListener('headerAddButtonClicked', onAdd);
    return () => window.removeEventListener('headerAddButtonClicked', onAdd);
  }, []);

  const selected = presented.find((meal) => mealId(meal) === selectedId) || null;
  const detail = selected ? (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto', py: 1, px: { xs: 1, sm: 0 } }}>
      <MealCard
        meal={selected}
        onChange={(next) => updateMeal(mealId(selected), next)}
        onDelete={() => deleteMeal(selected)}
        onClose={() => setSelectedId('')}
      />
    </Box>
  ) : null;

  const list = (
    <MealList
      meals={presented}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
      {isDesktop ? (
        <SplitScreen start={list} detail={detail} sx={{ flex: 1, minHeight: 0 }} />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {list}
          {detail}
        </Box>
      )}
    </Box>
  );
}

function mealEvent(meal) {
  const orderedFranjas = MEAL_FRANJAS.filter((item) => meal.franjas.includes(item.id));
  return {
    task: {
      titulo: meal.nombre || 'Nueva comida',
      tipo: 'EVENTO',
      estado: 'PENDIENTE',
    },
    start: franjaDate(orderedFranjas[0]?.id, false),
    end: franjaDate(orderedFranjas[orderedFranjas.length - 1]?.id, true),
    allDay: orderedFranjas.length === 0,
  };
}

function MealList({ meals, selectedId, onSelect }) {
  return (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1, px: { xs: 1, sm: 0 }, py: 1 }}>
      {meals.length === 0 ? <EmptyState /> : meals.map((meal) => {
        const id = mealId(meal);
        return (
          <Box
            key={id}
            sx={{
              borderRadius: '4px',
              outline: id === selectedId ? '1px solid' : 'none',
              outlineColor: 'primary.main',
            }}
          >
            <TaskEventBlock timedCompact event={mealEvent(meal)} onClick={() => onSelect(id)} />
          </Box>
        );
      })}
    </Box>
  );
}

function MealCard({ meal, onChange, onDelete, onClose }) {
  const id = mealId(meal);
  const toggleDay = (day) => {
    const dias = meal.dias.includes(day)
      ? meal.dias.filter((value) => value !== day)
      : [...meal.dias, day].sort((a, b) => a - b);
    onChange({ ...meal, dias });
  };
  const toggleFranja = (franja) => {
    const franjas = meal.franjas.includes(franja)
      ? meal.franjas.filter((value) => value !== franja)
      : [...meal.franjas, franja];
    onChange({ ...meal, franjas });
  };
  const updateIngredient = (index, patch) => {
    const ingredientes = meal.ingredientes.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    onChange({ ...meal, ingredientes });
  };

  return (
    <Box id={`comida-${id}`} sx={{ borderRadius: '4px', overflow: 'hidden' }}>
      <Stack spacing={1} sx={{ p: 1.5 }} onClick={(event) => event.stopPropagation()}>
        <TareaFormTitleField
          value={meal.nombre}
          onChange={(event) => onChange({ ...meal, nombre: event.target.value })}
          placeholder="Agregar título"
          autoFocus
          action={(
            <IconButton aria-label="Cerrar comida" size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        />
        <TextField
          size="small"
          type="number"
          label="Porciones"
          value={meal.porciones ?? 1}
          onChange={(event) => onChange({ ...meal, porciones: event.target.value })}
          inputProps={{ min: 1, step: 1 }}
          sx={{ width: 120 }}
        />
        <Stack spacing={0.75}>
          {meal.ingredientes.map((item, index) => (
            <Stack key={`${id}-ing-${index}`} direction="row" spacing={0.5} alignItems="center">
              <TextField
                size="small"
                label="Ingrediente"
                value={item.nombre || ''}
                onChange={(event) => updateIngredient(index, { nombre: event.target.value })}
                sx={{ flex: 1 }}
              />
              <IconButton
                aria-label="Quitar ingrediente"
                size="small"
                onClick={() => onChange({
                  ...meal,
                  ingredientes: meal.ingredientes.filter((_, itemIndex) => itemIndex !== index),
                })}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Box>
            <IconButton
              aria-label="Agregar ingrediente"
              size="small"
              onClick={() => onChange({
                ...meal,
                ingredientes: [...meal.ingredientes, { nombre: '' }],
              })}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <CadencePillToggle
            label="Diaria"
            selected={meal.frecuencia === 'DIARIA'}
            onClick={() => onChange({ ...meal, frecuencia: 'DIARIA' })}
          />
          <CadencePillToggle
            label="Semanal"
            selected={meal.frecuencia === 'SEMANAL'}
            onClick={() => onChange({ ...meal, frecuencia: 'SEMANAL' })}
          />
        </Stack>
        {meal.frecuencia === 'SEMANAL' && (
          <Stack direction="row" spacing={0.5}>
            {WEEK.map((day) => (
              <CadenceCircleToggle
                key={day.value}
                label={getDiaSemanaLetra(day.value)}
                selected={meal.dias.includes(day.value)}
                onClick={() => toggleDay(day.value)}
                ariaLabel={day.label}
              />
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={0.5}>
          {MEAL_FRANJAS.map((franja) => (
            <CadencePillToggle
              key={franja.id}
              label={franja.label}
              selected={meal.franjas.includes(franja.id)}
              onClick={() => toggleFranja(franja.id)}
              ariaLabel={`Franja ${franja.label}`}
            />
          ))}
        </Stack>
        <Box>
          <IconButton aria-label="Eliminar comida" size="small" onClick={onDelete}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Stack>
    </Box>
  );
}

function franjaDate(franjaId, end) {
  const franja = MEAL_FRANJAS.find((item) => item.id === franjaId);
  if (!franja) return null;
  const [hours, minutes] = (end ? franja.fin : franja.inicio).split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export default Nutricion;
