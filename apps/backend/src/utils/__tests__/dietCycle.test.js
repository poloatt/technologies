import {
  aggregateDietCycle,
  aggregateMeals,
  buildDietTimeline,
  cycleBounds,
  dietCycleIndex,
  matchDespensa,
  mealPlacements,
  normalizeDietPlan,
  resolveCycleDietHabitCaptions,
  resolveDietDay,
} from '@attadia/shared/pulso/dietCycle.js';
import { resolveDietHabitCaptions } from '@attadia/shared/pulso/dietHabitLink.js';

const queso = {
  id: 'queso',
  nombre: 'Queso de la semana',
  calorias: 400,
  proteinas: 25,
  carbohidratos: 2,
  grasas: 30,
  ingredientes: [{ nombre: 'queso', cantidad: 150, unidad: 'g', canal: 'super' }],
};

const pollo = {
  id: 'pollo',
  nombre: 'Pollo',
  calorias: 500,
  proteinas: 40,
  carbohidratos: 0,
  grasas: 12,
  ingredientes: [{ nombre: 'pollo', cantidad: 200, unidad: 'g', canal: 'super' }],
};

function weeklyPlan(assignments) {
  const base = normalizeDietPlan({ cadencia: 1, frecuencia: 'SEMANAL' });
  return {
    ...base,
    rotacion: base.rotacion.map((row) => ({
      indice: row.indice,
      recetas: { 1: assignments[row.indice] || '' },
    })),
  };
}

describe('dietCycle', () => {
  it('toma el lunes como primer día de la frecuencia semanal', () => {
    expect(dietCycleIndex('2026-09-21', 'SEMANAL')).toBe(0);
    expect(dietCycleIndex('2026-09-22', 'SEMANAL')).toBe(1);
    expect(dietCycleIndex('2026-09-26', 'SEMANAL')).toBe(5);
  });

  it('rota una comida por día a lo largo de la semana', () => {
    const plan = weeklyPlan(['pollo', 'queso', 'queso', 'queso', 'queso', 'queso', 'queso']);
    const martes = resolveDietDay({
      plan,
      recetas: [pollo, queso],
      fecha: '2026-09-22',
    });
    expect(martes.etiqueta).toBe('Martes');
    expect(martes.comidas[0].receta.nombre).toBe('Queso de la semana');
  });

  it('suma macros e ingredientes de toda la frecuencia, no de una comida', () => {
    const plan = weeklyPlan(['pollo', 'queso', 'queso', 'queso', 'queso', 'queso', 'queso']);
    const cycle = aggregateDietCycle({ plan, recetas: [pollo, queso] });
    expect(cycle.macros.calorias).toBe(500 + 400 * 6);
    expect(cycle.macros.comidas).toBe(7);
    const cheese = cycle.ingredientes.find((item) => item.nombre === 'queso');
    expect(cheese.cantidad).toBe(150 * 6);
    expect(cheese.unidad).toBe('g');
  });

  it('separa la franja de comida, el ayuno y la hidratación', () => {
    const plan = normalizeDietPlan({
      cadencia: 1,
      frecuencia: 'DIARIA',
      comidas: [{ orden: 1, inicio: '13:00', fin: '14:00' }],
      huecos: [
        { id: 'antes', tipo: 'HIDRATACION' },
        { id: 'despues', tipo: 'AYUNO' },
      ],
    });
    expect(buildDietTimeline(plan)).toEqual([
      { id: 'antes', tipo: 'HIDRATACION', inicio: '00:00', fin: '13:00', orden: null },
      { id: 'comida-1', tipo: 'COMIDA', inicio: '13:00', fin: '14:00', orden: 1 },
      { id: 'despues', tipo: 'AYUNO', inicio: '14:00', fin: '24:00', orden: null },
    ]);
  });

  it('marca reposición contra la despensa y las compras de Caja', () => {
    const [quesoSemana] = matchDespensa(
      [{ nombre: 'queso', cantidad: 900, unidad: 'g', canal: 'super' }, { nombre: 'mate', cantidad: 1, unidad: 'u', canal: 'super' }],
      {
        inventario: [{ nombre: 'Yerba mate', cantidad: 1 }],
        transacciones: [{ descripcion: 'Queso tybo', categoria: 'Comida y Mercado' }],
      },
    );
    expect(quesoSemana.comprado).toBe(true);
    expect(quesoSemana.enDespensa).toBe(false);
  });

  it('abre la semana de reposición el lunes', () => {
    expect(cycleBounds('2026-09-26', 'SEMANAL')).toMatchObject({
      inicio: '2026-09-21',
      fin: '2026-09-28',
      indice: 5,
    });
  });

  it('publica en Foco la receta del día y la compra de la semana', () => {
    const plan = weeklyPlan(['pollo', 'queso', 'queso', 'queso', 'queso', 'queso', 'queso']);
    const ingredientes = matchDespensa(
      aggregateDietCycle({ plan, recetas: [pollo, queso] }).ingredientes,
      { inventario: [], transacciones: [] },
    );
    const captions = resolveDietHabitCaptions({
      plan,
      recetas: [pollo, queso],
      fecha: '2026-09-22',
      ingredientes,
      habits: {
        nutricion: [
          { id: 'cocinar', label: 'Cocinar', activo: true },
          { id: 'agua', label: 'Beber agua', activo: true },
        ],
        compras: [
          { id: 'super', label: 'Compra de super', activo: true },
        ],
      },
      habitConfig: {
        compras: { super: { tipo: 'SEMANAL' } },
      },
    });
    expect(captions.nutricion.cocinar).toBe('Martes · Queso de la semana');
    expect(captions.nutricion.agua).toContain('agua, mate, café, infusiones');
    expect(captions.compras.super).toContain('reponer queso 900 g');
    expect(captions.compras.super).toContain('reponer pollo 200 g');
  });

  it('ubica una comida semanal en el día y la franja elegidos', () => {
    const meals = [{
      id: 'pollo',
      nombre: 'Pollo',
      frecuencia: 'SEMANAL',
      dias: [2],
      franjas: ['NOCHE'],
      ingredientes: [{ nombre: 'pollo', cantidad: 200, unidad: 'g', canal: 'super' }],
    }];
    expect(mealPlacements(meals, 0)).toEqual([]);
    expect(mealPlacements(meals, 1)).toEqual([{ receta: meals[0], franja: 'NOCHE' }]);
    expect(aggregateMeals(meals).ingredientes[0].cantidad).toBe(200);
  });

  it('no duplica la leyenda si el hábito ya está vinculado', () => {
    const plan = weeklyPlan(['pollo']);
    plan.vinculos = {
      ...plan.vinculos,
      cocina: [{ orden: 0, section: 'nutricion', habitId: 'cocinar' }],
    };
    const captions = resolveCycleDietHabitCaptions({
      plan,
      recetas: [pollo],
      fecha: '2026-09-21',
      habits: { nutricion: [{ id: 'cocinar', label: 'Cocinar', activo: true }] },
    });
    expect(captions.nutricion.cocinar).toBe('Lunes · Pollo');
  });
});
