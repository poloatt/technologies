import { DietaPlan, Receta, MenuDia } from '../models/index.js';
import { defaultDietPlanVinculos, resolveDietHabitCaptions } from '@attadia/shared/pulso';

function userId(req) {
  return req.user?._id || req.user?.id;
}

function startOfUtcDay(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

export const dietasController = {
  getPlan: async (req, res) => {
    try {
      const plan = await ensurePlan(userId(req));
      res.json(plan);
    } catch (error) {
      console.error('Error al obtener plan de dieta:', error);
      res.status(500).json({ error: 'Error al obtener el plan' });
    }
  },

  updatePlan: async (req, res) => {
    try {
      const usuario = userId(req);
      await ensurePlan(usuario);
      const { calorias, proteinas, carbohidratos, grasas, slots, vinculos } = req.body;
      const plan = await DietaPlan.findOneAndUpdate(
        { usuario },
        { calorias, proteinas, carbohidratos, grasas, slots, vinculos },
        { new: true },
      );
      res.json(plan);
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

  getHabitCaptions: async (req, res) => {
    try {
      const usuario = userId(req);
      const fecha = startOfUtcDay(req.query.fecha);
      if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });
      const [plan, menu, recetas] = await Promise.all([
        DietaPlan.findOne({ usuario }).lean(),
        MenuDia.findOne({ usuario, fecha }).lean(),
        Receta.find({ usuario }).lean(),
      ]);
      const captions = resolveDietHabitCaptions({
        plan,
        menu,
        recetas,
      });
      res.json({ captions });
    } catch (error) {
      console.error('Error al armar leyendas de dieta:', error);
      res.status(500).json({ error: 'Error al armar las leyendas' });
    }
  },
};
