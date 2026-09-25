import { DataCorporal } from '../models/DataCorporal.js';

export const dataCorporalController = {
  // Obtener todos los registros
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 10, sort = '-fecha' } = req.query;
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        lean: true
      };

      const result = await DataCorporal.paginate({ usuario: req.user._id }, options);
      res.json(result);
    } catch (error) {
      console.error('Error al obtener registros:', error);
      res.status(500).json({ msg: 'Error al obtener los registros' });
    }
  },

  // Obtener un registro por ID
  getById: async (req, res) => {
    try {
      const registro = await DataCorporal.findOne({
        _id: req.params.id,
        usuario: req.user._id
      }).lean();

      if (!registro) {
        return res.status(404).json({ msg: 'Registro no encontrado' });
      }

      res.json(registro);
    } catch (error) {
      console.error('Error al obtener registro:', error);
      res.status(500).json({ msg: 'Error al obtener el registro' });
    }
  },

  // Crear un nuevo registro
  create: async (req, res) => {
    try {
      // Verificar si ya existe un registro para esa fecha
      const existingRecord = await DataCorporal.findOne({
        fecha: new Date(req.body.fecha),
        usuario: req.user._id
      });

      if (existingRecord) {
        return res.status(409).json({ msg: 'Ya existe un registro para esta fecha' });
      }

      const registro = new DataCorporal({
        ...req.body,
        origen: req.body.origen === 'samsung' ? 'samsung' : 'manual',
        usuario: req.user._id
      });

      await registro.save();
      res.status(201).json(registro);
    } catch (error) {
      console.error('Error al crear registro:', error);
      res.status(500).json({ msg: 'Error al crear el registro' });
    }
  },

  // Actualizar un registro
  update: async (req, res) => {
    try {
      // Verificar si ya existe otro registro para la nueva fecha
      if (req.body.fecha) {
        const existingRecord = await DataCorporal.findOne({
          fecha: new Date(req.body.fecha),
          usuario: req.user._id,
          _id: { $ne: req.params.id }
        });

        if (existingRecord) {
          return res.status(409).json({ msg: 'Ya existe un registro para esta fecha' });
        }
      }

      const updates = { ...req.body };
      delete updates.origen;
      const registro = await DataCorporal.findOneAndUpdate(
        {
          _id: req.params.id,
          usuario: req.user._id
        },
        updates,
        { new: true }
      );

      if (!registro) {
        return res.status(404).json({ msg: 'Registro no encontrado' });
      }

      res.json(registro);
    } catch (error) {
      console.error('Error al actualizar registro:', error);
      res.status(500).json({ msg: 'Error al actualizar el registro' });
    }
  },

  // Eliminar un registro
  delete: async (req, res) => {
    try {
      const registro = await DataCorporal.findOneAndDelete({
        _id: req.params.id,
        usuario: req.user._id
      });

      if (!registro) {
        return res.status(404).json({ msg: 'Registro no encontrado' });
      }

      res.json({ msg: 'Registro eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar registro:', error);
      res.status(500).json({ msg: 'Error al eliminar el registro' });
    }
  }
}; 