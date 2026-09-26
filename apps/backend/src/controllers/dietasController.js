import {
  DietaPlan,
  Receta,
  MenuDia,
  Users,
  Inventarios,
  Transacciones,
} from '../models/index.js';
import {
  aggregateDietCycle,
  aggregateMeals,
  cycleBounds,
  defaultDietPlanVinculos,
  matchDespensa,
  mealsUseSchedule,
  normalizeDietPlan,
  planHasRotation,
  resolveDietHabitCaptions,
  scheduleToPlan,
} from '@attadia/shared/pulso';

function userId(req) {
  return req.user?._id || req.user?.id;
}

function startOfUtcDay(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function presentPlan(plan) {
  const raw = plan?.toObject ? plan.toObject() : { ...(plan || {}) };
  return { ...raw, ...normalizeDietPlan(raw) };
}

async function ensurePlan(usuario) {
  let plan = await DietaPlan.findOne({ usuario });
  if (!plan) {
    plan = await DietaPlan.create({
      usuario,
      vinculos: defaultDietPlanVinculos(),
    });
  }
  return plan;
}

function viewPlan(plan, recetas) {
  if (!mealsUseSchedule(recetas)) return normalizeDietPlan(plan);
  return scheduleToPlan(recetas, plan?.vinculos);
}

async function loadDespensa(usuario, plan, recetas, fecha) {
  const view = viewPlan(plan, recetas);
  const agregados = mealsUseSchedule(recetas)
    ? aggregateMeals(recetas)
    : aggregateDietCycle({ plan: view, recetas });
  const bounds = cycleBounds(fecha, view.frecuencia || 'SEMANAL');
  if (!agregados.ingredientes.length) {
    return { ...bounds, ingredientes: [] };
  }
  const inicio = new Date(`${bounds.inicio}T00:00:00.000Z`);
  const fin = new Date(`${bounds.fin}T00:00:00.000Z`);
  const [inventario, transacciones] = await Promise.all([
    Inventarios.find({ usuario }).select('nombre cantidad').lean(),
    Transacciones.find({
      usuario,
      tipo: 'EGRESO',
      categoria: { $in: ['Comida y Mercado', 'Salud y Belleza'] },
      fecha: { $gte: inicio, $lt: fin },
    }).select('descripcion fecha categoria').lean(),
  ]);
  return {
    ...bounds,
    ingredientes: matchDespensa(agregados.ingredientes, { inventario, transacciones }),
  };
}

export const dietasController = {
  getPlan: async (req, res) => {
    try {
      const plan = await ensurePlan(userId(req));
      res.json(presentPlan(plan));
    } catch (error) {
      console.error('Error al obtener plan de dieta:', error);
      res.status(500).json({ error: 'Error al obtener el plan' });
    }
  },

  updatePlan: async (req, res) => {
    try {
      const usuario = userId(req);
      await ensurePlan(usuario);
      const next = normalizeDietPlan(req.body);
      const plan = await DietaPlan.findOneAndUpdate(
        { usuario },
        {
          calorias: next.calorias,
          proteinas: next.proteinas,
          carbohidratos: next.carbohidratos,
          grasas: next.grasas,
          cadencia: next.cadencia,
          frecuencia: next.frecuencia,
          comidas: next.comidas,
          huecos: next.huecos,
          rotacion: next.rotacion,
          vinculos: next.vinculos,
        },
        { new: true },
      );
      res.json(presentPlan(plan));
    } catch (error) {
      console.error('Error al guardar plan de dieta:', error);
      res.status(500).json({ error: 'Error al guardar el plan' });
    }
  },

  getRecetas: async (req, res) => {
    try {
      const recetas = await Receta.find({ usuario: userId(req) }).sort({ nombre: 1 });
      res.json(recetas);
    } catch (error) {
      console.error('Error al obtener recetas:', error);
      res.status(500).json({ error: 'Error al obtener recetas' });
    }
  },

  createReceta: async (req, res) => {
    try {
      const receta = await Receta.create({
        ...req.body,
        usuario: userId(req),
      });
      res.status(201).json(receta);
    } catch (error) {
      console.error('Error al crear receta:', error);
      res.status(500).json({ error: 'Error al crear la receta' });
    }
  },

  updateReceta: async (req, res) => {
    try {
      const receta = await Receta.findOneAndUpdate(
        { _id: req.params.id, usuario: userId(req) },
        req.body,
        { new: true },
      );
      if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });
      res.json(receta);
    } catch (error) {
      console.error('Error al actualizar receta:', error);
      res.status(500).json({ error: 'Error al actualizar la receta' });
    }
  },

  deleteReceta: async (req, res) => {
    try {
      const receta = await Receta.findOneAndDelete({
        _id: req.params.id,
        usuario: userId(req),
      });
      if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });
      res.json({ msg: 'Receta eliminada' });
    } catch (error) {
      console.error('Error al eliminar receta:', error);
      res.status(500).json({ error: 'Error al eliminar la receta' });
    }
  },

  getMenu: async (req, res) => {
    try {
      const fecha = startOfUtcDay(req.query.fecha);
      if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });
      const menu = await MenuDia.findOne({ usuario: userId(req), fecha });
      res.json(menu || { fecha, slots: {} });
    } catch (error) {
      console.error('Error al obtener menú:', error);
      res.status(500).json({ error: 'Error al obtener el menú' });
    }
  },

  upsertMenu: async (req, res) => {
    try {
      const fecha = startOfUtcDay(req.body.fecha);
      if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });
      const menu = await MenuDia.findOneAndUpdate(
        { usuario: userId(req), fecha },
        { slots: req.body.slots || {}, fecha },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      res.json(menu);
    } catch (error) {
      console.error('Error al guardar menú:', error);
      res.status(500).json({ error: 'Error al guardar el menú' });
    }
  },

  getDespensa: async (req, res) => {
    try {
      const usuario = userId(req);
      const fecha = startOfUtcDay(req.query.fecha);
      if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });
      const [plan, recetas] = await Promise.all([
        ensurePlan(usuario),
        Receta.find({ usuario }).lean(),
      ]);
      const despensa = await loadDespensa(usuario, plan, recetas, req.query.fecha);
      res.json(despensa);
    } catch (error) {
      console.error('Error al calcular la reposición:', error);
      res.status(500).json({ error: 'Error al calcular la reposición' });
    }
  },

  getHabitCaptions: async (req, res) => {
    try {
      const usuario = userId(req);
      const fecha = startOfUtcDay(req.query.fecha);
      if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });
      const [plan, menu, recetas, user] = await Promise.all([
        DietaPlan.findOne({ usuario }).lean(),
        MenuDia.findOne({ usuario, fecha }).lean(),
        Receta.find({ usuario }).lean(),
        Users.findById(usuario).select('customHabits preferences.rutinasConfig').lean(),
      ]);
      const view = viewPlan(plan, recetas);
      const despensa = (mealsUseSchedule(recetas) || planHasRotation(plan))
        ? await loadDespensa(usuario, plan, recetas, req.query.fecha)
        : null;
      const captions = resolveDietHabitCaptions({
        plan: view,
        menu,
        recetas,
        fecha: req.query.fecha,
        habits: user?.customHabits,
        habitConfig: user?.preferences?.rutinasConfig,
        ingredientes: despensa?.ingredientes,
      });
      res.json({ captions });
    } catch (error) {
      console.error('Error al armar leyendas de dieta:', error);
      res.status(500).json({ error: 'Error al armar las leyendas' });
    }
  },
};
