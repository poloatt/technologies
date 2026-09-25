import { ControlSalud, SaludItem } from '../models/index.js';
import { Tareas } from '../models/Tareas.js';
import { DEFAULT_CONTROLES, resolveControlesStatus } from '@attadia/shared/pulso';

function userId(req) {
  return req.user?._id || req.user?.id;
}

function tareaPatch(item) {
  const estado = item.estado === 'HECHO'
    ? 'COMPLETADA'
    : item.estado === 'CANCELADO'
      ? 'CANCELADA'
      : 'PENDIENTE';
  return {
    titulo: item.titulo,
    descripcion: item.notas || '',
    fechaInicio: item.fecha,
    fechaVencimiento: item.fecha,
    etiqueta: 'salud',
    pulsoRef: item._id,
    estado,
    completada: estado === 'COMPLETADA',
  };
}

async function projectTarea(item, usuario) {
  const patch = tareaPatch(item);
  if (item.tareaId) {
    await Tareas.findOneAndUpdate(
      { _id: item.tareaId, usuario },
      { $set: patch },
    );
    return item.tareaId;
  }
  const tarea = await Tareas.create({
    ...patch,
    usuario,
    owners: [usuario],
  });
  item.tareaId = tarea._id;
  await item.save();
  return tarea._id;
}

async function cancelTarea(tareaId, usuario) {
  if (!tareaId) return;
  await Tareas.findOneAndUpdate(
    { _id: tareaId, usuario },
    { $set: { estado: 'CANCELADA', completada: false, etiqueta: 'salud' } },
  );
}

async function ensureControles(usuario) {
  const count = await ControlSalud.countDocuments({ usuario });
  if (count > 0) return;
  await ControlSalud.insertMany(DEFAULT_CONTROLES.map((control) => ({
    ...control,
    usuario,
  })));
}

export const saludController = {
  getControles: async (req, res) => {
    try {
      const usuario = userId(req);
      await ensureControles(usuario);
      const [controles, items] = await Promise.all([
        ControlSalud.find({ usuario }).sort({ label: 1 }).lean(),
        SaludItem.find({ usuario }).lean(),
      ]);
      res.json({ controles: resolveControlesStatus(controles, items) });
    } catch (error) {
      console.error('Error al obtener controles:', error);
      res.status(500).json({ error: 'Error al obtener controles' });
    }
  },

  createControl: async (req, res) => {
    try {
      const control = await ControlSalud.create({
        usuario: userId(req),
        controlId: req.body.controlId || `ctrl_${Date.now()}`,
        zona: req.body.zona,
        label: req.body.label,
        intervaloDias: Number(req.body.intervaloDias) || 365,
      });
      res.status(201).json(control);
    } catch (error) {
      console.error('Error al crear control:', error);
      res.status(500).json({ error: 'Error al crear el control' });
    }
  },

  updateControl: async (req, res) => {
    try {
      const control = await ControlSalud.findOneAndUpdate(
        { controlId: req.params.controlId, usuario: userId(req) },
        {
          zona: req.body.zona,
          label: req.body.label,
          intervaloDias: Number(req.body.intervaloDias) || 365,
        },
        { new: true },
      );
      if (!control) return res.status(404).json({ error: 'Control no encontrado' });
      res.json(control);
    } catch (error) {
      console.error('Error al actualizar control:', error);
      res.status(500).json({ error: 'Error al actualizar el control' });
    }
  },

  deleteControl: async (req, res) => {
    try {
      const usuario = userId(req);
      const control = await ControlSalud.findOneAndDelete({
        controlId: req.params.controlId,
        usuario,
      });
      if (!control) return res.status(404).json({ error: 'Control no encontrado' });
      const items = await SaludItem.find({ usuario, controlId: control.controlId });
      await Promise.all(items.map((item) => cancelTarea(item.tareaId, usuario)));
      await SaludItem.deleteMany({ usuario, controlId: control.controlId });
      res.json({ msg: 'Control eliminado' });
    } catch (error) {
      console.error('Error al eliminar control:', error);
      res.status(500).json({ error: 'Error al eliminar el control' });
    }
  },

  getItems: async (req, res) => {
    try {
      const query = { usuario: userId(req) };
      if (req.query.controlId) query.controlId = req.query.controlId;
      const items = await SaludItem.find(query).sort({ fecha: -1 });
      res.json(items);
    } catch (error) {
      console.error('Error al obtener ítems de salud:', error);
      res.status(500).json({ error: 'Error al obtener ítems' });
    }
  },

  createItem: async (req, res) => {
    try {
      const usuario = userId(req);
      const item = await SaludItem.create({
        usuario,
        controlId: req.body.controlId,
        tipo: req.body.tipo,
        titulo: req.body.titulo,
        fecha: req.body.fecha,
        estado: req.body.estado || 'PENDIENTE',
        notas: req.body.notas || '',
      });
      await projectTarea(item, usuario);
      res.status(201).json(item);
    } catch (error) {
      console.error('Error al crear ítem de salud:', error);
      res.status(500).json({ error: 'Error al crear el ítem' });
    }
  },

  updateItem: async (req, res) => {
    try {
      const usuario = userId(req);
      const item = await SaludItem.findOne({ _id: req.params.id, usuario });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
      item.controlId = req.body.controlId ?? item.controlId;
      item.tipo = req.body.tipo ?? item.tipo;
      item.titulo = req.body.titulo ?? item.titulo;
      item.fecha = req.body.fecha ?? item.fecha;
      item.estado = req.body.estado ?? item.estado;
      item.notas = req.body.notas ?? item.notas;
      await item.save();
      await projectTarea(item, usuario);
      res.json(item);
    } catch (error) {
      console.error('Error al actualizar ítem de salud:', error);
      res.status(500).json({ error: 'Error al actualizar el ítem' });
    }
  },

  deleteItem: async (req, res) => {
    try {
      const usuario = userId(req);
      const item = await SaludItem.findOneAndDelete({ _id: req.params.id, usuario });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
      await cancelTarea(item.tareaId, usuario);
      res.json({ msg: 'Ítem eliminado' });
    } catch (error) {
      console.error('Error al eliminar ítem de salud:', error);
      res.status(500).json({ error: 'Error al eliminar el ítem' });
    }
  },
};
