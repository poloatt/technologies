import { BaseController } from './BaseController.js';
import { Cuentas } from '../models/index.js';
import {
  attachMonedasToCuentaJson,
  ensureEfectivoAccount,
  getEnabledMonedasForUser,
} from '../services/efectivoAccountService.js';

class CuentasController extends BaseController {
  constructor() {
    super(Cuentas, {
      searchFields: ['nombre', 'numero'],
      populate: [
        {
          path: 'moneda',
          select: 'nombre simbolo codigo color'
        }
      ]
    });

    // Bind de los métodos al contexto de la instancia
    this.getAll = this.getAll.bind(this);
    this.getById = this.getById.bind(this);
    this.getSelectOptions = this.getSelectOptions.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.getAllAdmin = this.getAllAdmin.bind(this);
    this.getAdminStats = this.getAdminStats.bind(this);
  }

  // GET /api/cuentas — garantiza la cuenta Efectivo por defecto y adjunta monedas habilitadas
  async getAll(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      await ensureEfectivoAccount(req.user.id);
      const monedasHabilitadas = await getEnabledMonedasForUser(req.user.id);

      const {
        page = 1,
        limit = 50,
        sort = '-esDefault -createdAt',
        search,
        filter,
        select
      } = req.query;

      const query = { usuario: req.user.id };

      if (search) {
        query.$or = this.options.searchFields.map(field => ({
          [field]: { $regex: search, $options: 'i' }
        }));
      }

      if (filter) {
        Object.assign(query, JSON.parse(filter), { usuario: req.user.id });
      }

      const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort,
        select,
        populate: this.options.populate
      };

      const result = await this.Model.paginate(query, options);
      const docs = (result.docs || []).map((doc) =>
        attachMonedasToCuentaJson(doc, monedasHabilitadas)
      );

      res.json({ ...result, docs });
    } catch (error) {
      console.error('Error en CuentasController.getAll:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/cuentas/:id
  async getById(req, res) {
    try {
      const item = await this.Model.findById(req.params.id).populate(this.options.populate);
      if (!item) {
        return res.status(404).json({ message: 'Recurso no encontrado' });
      }
      const userId = req.user?.id || item.usuario;
      const monedasHabilitadas = await getEnabledMonedasForUser(userId);
      res.json(attachMonedasToCuentaJson(item, monedasHabilitadas));
    } catch (error) {
      console.error('Error en CuentasController.getById:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/cuentas/select-options
  async getSelectOptions(req, res) {
    try {
      if (req.user?.id) {
        await ensureEfectivoAccount(req.user.id);
      }
      const { filter } = req.query;
      const query = filter ? JSON.parse(filter) : { activo: true };
      if (req.user?.id) {
        query.usuario = req.user.id;
      }

      const items = await this.Model.find(query)
        .sort({ esDefault: -1, createdAt: -1 })
        .populate(this.options.populate);
      const monedasHabilitadas = req.user?.id
        ? await getEnabledMonedasForUser(req.user.id)
        : [];

      const options = items.map((item) => {
        const option = item.toSelectOption();
        option.data = attachMonedasToCuentaJson(item, monedasHabilitadas);
        return option;
      });
      res.json(options);
    } catch (error) {
      console.error('Error en CuentasController.getSelectOptions:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Sobreescribir el método create para asegurar que se asigna el usuario y la moneda
  async create(req, res) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const isMultimoneda = Boolean(req.body.multimoneda);
      if (!isMultimoneda && !req.body.moneda) {
        return res.status(400).json({ error: 'Debe especificar una moneda' });
      }

      const cuenta = new this.Model({
        ...req.body,
        usuario: req.user.id,
        esDefault: false,
      });

      await cuenta.save();
      await cuenta.populate(this.options.populate);

      const monedasHabilitadas = isMultimoneda
        ? await getEnabledMonedasForUser(req.user.id)
        : [];

      res.status(201).json(attachMonedasToCuentaJson(cuenta, monedasHabilitadas));
    } catch (error) {
      console.error('Error al crear cuenta:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Error de validación',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // Sobreescribir el método update para mantener el usuario original y manejar moneda
  async update(req, res) {
    try {
      const cuenta = await this.Model.findById(req.params.id);
      if (!cuenta) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }

      const isDefault = Boolean(cuenta.esDefault);
      const isMultimoneda = isDefault || Boolean(req.body.multimoneda ?? cuenta.multimoneda);

      if (!isMultimoneda && !req.body.moneda) {
        return res.status(400).json({ error: 'Debe especificar una moneda' });
      }

      const datosActualizados = {
        ...req.body,
        usuario: cuenta.usuario,
      };

      if (isDefault) {
        datosActualizados.esDefault = true;
        datosActualizados.multimoneda = true;
        datosActualizados.tipo = 'EFECTIVO';
        datosActualizados.activo = true;
        if (!datosActualizados.moneda && cuenta.moneda) {
          datosActualizados.moneda = cuenta.moneda._id || cuenta.moneda;
        }
      }

      const cuentaActualizada = await this.Model.findByIdAndUpdate(
        req.params.id,
        datosActualizados,
        { new: true, runValidators: true }
      ).populate(this.options.populate);

      const monedasHabilitadas = isMultimoneda
        ? await getEnabledMonedasForUser(cuenta.usuario)
        : [];

      res.json(attachMonedasToCuentaJson(cuentaActualizada, monedasHabilitadas));
    } catch (error) {
      console.error('Error al actualizar cuenta:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Error de validación',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/cuentas/:id — protege la cuenta Efectivo por defecto
  async delete(req, res) {
    try {
      const cuenta = await this.Model.findById(req.params.id);
      if (!cuenta) {
        return res.status(404).json({ message: 'Cuenta no encontrada' });
      }
      if (cuenta.esDefault) {
        return res.status(400).json({
          error: 'La cuenta Efectivo por defecto no se puede eliminar',
          message: 'La cuenta Efectivo por defecto no se puede eliminar',
        });
      }
      await this.Model.findByIdAndDelete(req.params.id);
      res.json({ message: 'Cuenta eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/cuentas/admin/all
  async getAllAdmin(req, res) {
    try {
      const result = await this.Model.paginate(
        {},
        {
          populate: [
            { path: 'moneda' },
            { path: 'usuario', select: 'nombre email' }
          ],
          sort: { createdAt: 'desc' }
        }
      );
      res.json(result);
    } catch (error) {
      console.error('Error al obtener todas las cuentas:', error);
      res.status(500).json({ error: 'Error al obtener todas las cuentas' });
    }
  }

  // GET /api/cuentas/admin/stats
  async getAdminStats(req, res) {
    try {
      const totalCuentas = await this.Model.countDocuments();
      const cuentasPorMoneda = await this.Model.aggregate([
        {
          $group: {
            _id: '$moneda',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'monedas',
            localField: '_id',
            foreignField: '_id',
            as: 'moneda'
          }
        },
        {
          $unwind: '$moneda'
        }
      ]);

      res.json({
        totalCuentas,
        cuentasPorMoneda
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }
}

export const cuentasController = new CuentasController();
