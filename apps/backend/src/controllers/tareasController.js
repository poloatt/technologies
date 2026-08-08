import { BaseController } from './BaseController.js';
import { Tareas, Subtareas, Objetivos } from '../models/index.js';
import mongoose from 'mongoose';

class TareasController extends BaseController {
  constructor() {
    super(Tareas, {
      searchFields: ['titulo', 'descripcion'],
      defaultPopulate: [
        {
          path: 'objetivo',
          select: 'nombre descripcion estado',
        },
        {
          path: 'serieId',
          select: 'rrule activa dtstart',
        },
        {
          path: 'owners',
          select: 'nombre email',
        },
      ],
    });

    // Bind de los métodos al contexto de la instancia
    this.getByObjetivo = this.getByObjetivo.bind(this);
    this.getAllAdmin = this.getAllAdmin.bind(this);
    this.getAdminStats = this.getAdminStats.bind(this);
    this.updateSubtareas = this.updateSubtareas.bind(this);
    this.addSubtarea = this.addSubtarea.bind(this);
    this.removeSubtarea = this.removeSubtarea.bind(this);
    this.create = this.create.bind(this);
    this.updateEstado = this.updateEstado.bind(this);
    this.getAgenda = this.getAgenda.bind(this);
    this.getList = this.getList.bind(this);
    this.delete = this.delete.bind(this);
  }

  /**
   * DELETE /api/tareas/:id — borra en Mongo y, si está linkeada, en Google Tasks.
   * El fallo de Google no revierte el delete local (evita tareas fantasma en Attadia).
   */
  async delete(req, res) {
    try {
      const item = await Tareas.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Recurso no encontrado' });
      }

      const googleTaskId = item.googleTasksSync?.googleTaskId;
      const taskListId = item.googleTasksSync?.googleTaskListId;
      const userId = item.usuario?._id || item.usuario;

      await Tareas.findByIdAndDelete(req.params.id);

      if (googleTaskId && userId) {
        try {
          const googleTasksService = (await import('../services/googleTasksService.js')).default;
          await googleTasksService.deleteGoogleTask(String(userId), taskListId, googleTaskId);
        } catch (googleErr) {
          console.warn(
            `Tarea ${req.params.id} eliminada localmente; Google Tasks falló:`,
            googleErr?.message || googleErr,
          );
        }
      }

      return res.json({ message: 'Recurso eliminado correctamente' });
    } catch (error) {
      console.error('Error en delete tarea:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /api/tareas/list — lista Ahora/Luego acotada (sin paginar todo el universo)
  async getList(req, res) {
    try {
      const { from, to, view, includeCompleted } = req.query;
      const { getTareasForListRange, getDefaultListRange } = await import(
        '../utils/tareasAgendaUtils.js',
      );

      let rangeFrom;
      let rangeTo;
      if (from && to) {
        rangeFrom = new Date(from);
        rangeTo = new Date(to);
        if (Number.isNaN(rangeFrom.getTime()) || Number.isNaN(rangeTo.getTime())) {
          return res.status(400).json({ error: 'Fechas from/to no válidas' });
        }
      } else {
        const def = getDefaultListRange();
        rangeFrom = def.from;
        rangeTo = def.to;
      }

      const normalizedView =
        view === 'ahora' || view === 'luego' ? view : undefined;
      const include =
        includeCompleted === 'true'
        || includeCompleted === true
        || includeCompleted === '1';

      const docs = await getTareasForListRange(
        req.user.id,
        rangeFrom,
        rangeTo,
        { view: normalizedView, includeCompleted: include },
      );

      res.json({
        docs,
        totalDocs: docs.length,
        range: {
          from: rangeFrom.toISOString(),
          to: rangeTo.toISOString(),
        },
      });
    } catch (error) {
      console.error('Error getList:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/tareas/agenda?from=ISO&to=ISO — tareas + instancias de series en el rango visible
  async getAgenda(req, res) {
    try {
      const { from, to, includeCompleted } = req.query;
      if (!from || !to) {
        return res.status(400).json({ error: 'Parámetros from y to son requeridos (ISO)' });
      }

      const rangeFrom = new Date(from);
      const rangeTo = new Date(to);
      if (Number.isNaN(rangeFrom.getTime()) || Number.isNaN(rangeTo.getTime())) {
        return res.status(400).json({ error: 'Fechas from/to no válidas' });
      }

      const include =
        includeCompleted === 'true'
        || includeCompleted === true
        || includeCompleted === '1';

      const { getTareasForAgendaRange } = await import('../utils/tareasAgendaUtils.js');
      const { filterDocsForListView } = await import('../utils/tareasAgendaUtils.js');
      let docs = await getTareasForAgendaRange(
        req.user.id,
        rangeFrom,
        rangeTo,
      );
      if (!include) {
        docs = filterDocsForListView(docs, { includeCompleted: false });
      }

      res.json({ docs, totalDocs: docs.length });
    } catch (error) {
      console.error('Error getAgenda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/tareas/objetivo/:objetivoId
  async getByObjetivo(req, res) {
    try {
      const { objetivoId } = req.params;
      const { 
        page = 1, 
        limit = 10, 
        sort = '-fechaInicio',
        estado
      } = req.query;

      const query = { 
        objetivo: objetivoId,
        $or: [
          { usuario: req.user.id },
          { owners: req.user.id },
        ],
      };

      if (estado) query.estado = estado;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        lean: true,
        // El panel ya conoce el objetivo (no populate); se excluyen campos pesados.
        // subtareas se conserva: el form de edición las necesita.
        select: '-googleDueHistory -archivos -googleTasksSync.syncErrors',
      };

      const result = await this.Model.paginate(query, options);
      res.json(result);
    } catch (error) {
      console.error('Error en getByObjetivo:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/tareas/admin/all
  async getAllAdmin(req, res) {
    try {
      const result = await this.Model.paginate(
        {},
        {
          populate: this.options.defaultPopulate,
          sort: { createdAt: 'desc' }
        }
      );
      res.json(result);
    } catch (error) {
      console.error('Error al obtener todas las tareas:', error);
      res.status(500).json({ error: 'Error al obtener todas las tareas' });
    }
  }

  // GET /api/tareas/admin/stats
  async getAdminStats(req, res) {
    try {
      const totalTareas = await this.Model.countDocuments();
      const tareasPorEstado = await this.Model.aggregate([
        {
          $group: {
            _id: '$estado',
            count: { $sum: 1 }
          }
        }
      ]);

      const tareasPorPrioridad = await this.Model.aggregate([
        {
          $group: {
            _id: '$prioridad',
            count: { $sum: 1 }
          }
        }
      ]);

      const tareasPorObjetivo = await this.Model.aggregate([
        {
          $group: {
            _id: '$objetivo',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'objetivos',
            localField: '_id',
            foreignField: '_id',
            as: 'objetivo'
          }
        },
        {
          $unwind: '$objetivo'
        }
      ]);

      const subtareasStats = await Subtareas.aggregate([
        {
          $group: {
            _id: '$estado',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        totalTareas,
        tareasPorEstado,
        tareasPorPrioridad,
        tareasPorObjetivo,
        subtareasStats
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }

  // POST /api/tareas
  async create(req, res) {
    try {
      console.log('Creando tarea con datos:', req.body);
      
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Validar que el objetivo exista y pertenezca al usuario (solo si se especifica objetivo)
      if (req.body.objetivo) {
        const objetivo = await Objetivos.findOne({
          _id: req.body.objetivo,
          usuario: req.user.id
        });

        if (!objetivo) {
          return res.status(404).json({ error: 'El objetivo no existe o no pertenece al usuario' });
        }
      }

      const tipo = String(req.body.tipo || 'TAREA').toUpperCase();
      const normalizedTipo = tipo === 'EVENTO' ? 'EVENTO' : 'TAREA';

      const { rrule, ...tareaBody } = req.body;

      if (rrule && tareaBody.objetivo) {
        const { createSerie } = await import('./tareaSeriesController.js');
        const mockRes = {
          statusCode: 201,
          body: null,
          status(c) { this.statusCode = c; return this; },
          json(d) { this.body = d; return d; },
        };
        await createSerie(
          {
            user: req.user,
            body: {
              titulo: tareaBody.titulo,
              descripcion: tareaBody.descripcion,
              objetivo: tareaBody.objetivo,
              rrule,
              dtstart: tareaBody.fechaInicio,
              primeraInstancia: { ...tareaBody, tipo: normalizedTipo },
            },
          },
          mockRes,
        );
        if (mockRes.statusCode === 201 && mockRes.body?.primeraInstancia) {
          const saved = mockRes.body.primeraInstancia;
          return res.status(201).json({
            ...(saved.toObject ? saved.toObject() : saved),
            isGoogleTasksEnabled: saved.googleTasksSync?.enabled || false,
          });
        }
      }

      const tarea = new this.Model({
        ...tareaBody,
        tipo: normalizedTipo,
        usuario: req.user.id,
        owners: (() => {
          const incoming = Array.isArray(tareaBody.owners) ? tareaBody.owners : [];
          const ids = incoming
            .map((o) => String(o?._id ?? o?.id ?? o))
            .filter(Boolean);
          if (!ids.includes(String(req.user.id))) ids.unshift(String(req.user.id));
          return [...new Set(ids)];
        })(),
      });

      await tarea.save();
      await tarea.populate([
        {
          path: 'objetivo',
          select: 'nombre descripcion estado googleTasksSync',
        },
      ]);
      
      res.status(201).json({
        ...tarea.toObject(),
        isGoogleTasksEnabled: tarea.googleTasksSync?.enabled || false,
        googleTasksSyncStatus: tarea.googleTasksSync?.syncStatus || null,
        googleTaskId: tarea.googleTasksSync?.googleTaskId || null
      });
    } catch (error) {
      console.error('Error al crear tarea:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          error: 'Error de validación', 
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/tareas/:id/subtareas
  async addSubtarea(req, res) {
    try {
      const { id } = req.params;
      const tarea = await this.Model.findOne({ _id: id, usuario: req.user.id });

      if (!tarea) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }

      const subtarea = new Subtareas({
        ...req.body,
        tarea: id,
        usuario: req.user.id,
        orden: (tarea.subtareas?.length || 0) + 1
      });

      await subtarea.save();
      
      tarea.subtareas.push(subtarea._id);
      await tarea.save();

      res.status(201).json(subtarea);
    } catch (error) {
      console.error('Error al añadir subtarea:', error);
      res.status(500).json({ error: 'Error al añadir subtarea' });
    }
  }

  // DELETE /api/tareas/:id/subtareas/:subtareaId
  async removeSubtarea(req, res) {
    try {
      const { id, subtareaId } = req.params;
      const tarea = await this.Model.findOne({ _id: id, usuario: req.user.id });

      if (!tarea) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }

      // Eliminar la subtarea
      await Subtareas.findOneAndDelete({ 
        _id: subtareaId,
        tarea: id,
        usuario: req.user.id
      });

      // Eliminar la referencia de la tarea
      tarea.subtareas = tarea.subtareas.filter(
        subtarea => subtarea.toString() !== subtareaId
      );
      await tarea.save();

      res.json({ message: 'Subtarea eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar subtarea:', error);
      res.status(500).json({ error: 'Error al eliminar subtarea' });
    }
  }

  // PATCH /api/tareas/:id/subtareas
  async updateSubtareas(req, res) {
    try {
      const { id } = req.params;
      const { subtareaId, completada } = req.body;

      // Verificar que la tarea exista y pertenezca al usuario
      const tarea = await this.Model.findOne({
        _id: id,
        usuario: req.user.id,
      });

      if (!tarea) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }

      // Actualizar la subtarea específica
      if (subtareaId) {
        const subtareaIndex = tarea.subtareas.findIndex(
          st => st._id.toString() === subtareaId
        );

        if (subtareaIndex === -1) {
          return res.status(404).json({ error: 'Subtarea no encontrada' });
        }

        // Actualizar el estado de la subtarea
        tarea.subtareas[subtareaIndex].completada = completada;

        // Actualizar el estado de la tarea basado en las subtareas
        const todasCompletadas = tarea.subtareas.every(st => st.completada);
        const algunaCompletada = tarea.subtareas.some(st => st.completada);

        if (todasCompletadas) {
          tarea.estado = 'COMPLETADA';
          tarea.completada = true;
        } else if (algunaCompletada) {
          tarea.estado = 'EN_PROGRESO';
          tarea.completada = false;
        } else {
          tarea.estado = 'PENDIENTE';
          tarea.completada = false;
        }

        // Guardar los cambios
        await tarea.save();

        // Obtener la tarea actualizada con todas sus relaciones
        const tareaActualizada = await this.Model.findById(id).populate([
          {
            path: 'objetivo',
            select: 'nombre descripcion estado',
          },
        ]);

        // Actualizar el objetivo si es necesario
        const Objetivos = mongoose.model('Objetivos');
        const objetivo = await Objetivos.findById(tarea.objetivo);
        if (objetivo) {
          const tareasDelObjetivo = await this.Model.find({ objetivo: objetivo._id });
          const todasTareasCompletadas = tareasDelObjetivo.every(t => t.estado === 'COMPLETADA');
          const algunaTareaEnProgreso = tareasDelObjetivo.some(t => t.estado === 'EN_PROGRESO' || t.estado === 'COMPLETADA');
          
          let nuevoEstadoObjetivo = 'PENDIENTE';
          if (todasTareasCompletadas) {
            nuevoEstadoObjetivo = 'COMPLETADO';
          } else if (algunaTareaEnProgreso) {
            nuevoEstadoObjetivo = 'EN_PROGRESO';
          }
          
          await Objetivos.findByIdAndUpdate(objetivo._id, { estado: nuevoEstadoObjetivo });
        }

        return res.json(tareaActualizada);
      }

      // Si no hay subtareaId, actualizar todas las subtareas
      const { subtareas } = req.body;
      tarea.subtareas = subtareas;
      await tarea.save();

      const tareaActualizada = await this.Model.findById(id).populate([
        {
          path: 'objetivo',
          select: 'nombre descripcion estado',
        },
      ]);

      res.json(tareaActualizada);
    } catch (error) {
      console.error('Error al actualizar subtareas:', error);
      res.status(500).json({ error: 'Error al actualizar subtareas' });
    }
  }

  // PATCH /api/tareas/:id/estado
  async updateEstado(req, res) {
    try {
      const { estado } = req.body;

      if (!['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA'].includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
      }

      const update = { estado, completada: estado === 'COMPLETADA' };

      const tarea = await this.Model.findOneAndUpdate(
        {
          _id: req.params.id,
          $or: [{ usuario: req.user.id }, { owners: req.user.id }],
        },
        update,
        { new: true, runValidators: true },
      );

      if (!tarea) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
      }

      if (estado === 'COMPLETADA' && tarea.serieId && !tarea.esExcepcionSerie) {
        try {
          const { default: googleTasksService } = await import('../services/googleTasksService.js');
          const { generateNextSerieInstance } = await import('../services/googleTasksRecurrenceService.js');
          await generateNextSerieInstance(googleTasksService, tarea, req.user.id);
        } catch (serieErr) {
          console.warn('No se pudo generar siguiente ocurrencia de serie:', serieErr.message);
        }
      }

      res.json(tarea);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Sobrescribimos el método getAll del BaseController
  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit = 50, // Aumentamos el límite para mostrar más tareas
        sort = 'fechaInicio', // Ordenar por fecha de inicio por defecto
        estado,
        objetivo,
        periodo,
        tipo,
      } = req.query;

      const query = {
        $or: [
          { usuario: req.user.id },
          { owners: req.user.id },
        ],
      };
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (estado) {
        const parts = String(estado)
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        query.estado = parts.length > 1 ? { $in: parts } : parts[0];
      }
      if (objetivo) query.objetivo = objetivo;
      if (tipo && ['TAREA', 'EVENTO'].includes(String(tipo).toUpperCase())) {
        query.tipo = String(tipo).toUpperCase();
      }

      // Filtrar por período si se especifica
      if (periodo) {
        switch (periodo) {
          case 'hoy':
            query.fechaInicio = {
              $gte: today,
              $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
            break;
          case 'semana':
            const weekEnd = new Date(today);
            weekEnd.setDate(today.getDate() + 7);
            query.fechaInicio = { $gte: today, $lt: weekEnd };
            break;
          case 'mes':
            const monthEnd = new Date(today);
            monthEnd.setMonth(today.getMonth() + 1);
            query.fechaInicio = { $gte: today, $lt: monthEnd };
            break;
          case 'trimestre':
            const quarterEnd = new Date(today);
            quarterEnd.setMonth(today.getMonth() + 3);
            query.fechaInicio = { $gte: today, $lt: quarterEnd };
            break;
          case 'año':
            const yearEnd = new Date(today);
            yearEnd.setFullYear(today.getFullYear() + 1);
            query.fechaInicio = { $gte: today, $lt: yearEnd };
            break;
        }
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [
          {
            path: 'objetivo',
            select: 'nombre estado',
          },
          {
            path: 'owners',
            select: 'nombre email',
          },
        ],
        lean: true,
        leanWithId: true
      };

      const result = await this.Model.paginate(query, options);

      let docs = result.docs;
      // Virtuales solo en usos legacy con `periodo` explícito; lista/calendario usan /list y /agenda.
      if (periodo) {
        const { dedupeSerieInstancesForAgenda } = await import('../utils/calendarVirtualUtils.js');
        const { appendVirtualRecurrenceTasks } = await import('../utils/tareasAgendaUtils.js');
        docs = await appendVirtualRecurrenceTasks(
          req.user.id,
          dedupeSerieInstancesForAgenda(docs),
        );
      }

      const transformedDocs = docs.map((doc) => ({
        ...doc,
        id: doc._id != null ? String(doc._id) : doc.id,
        objetivo: doc.objetivo && doc.objetivo._id != null
          ? {
              ...doc.objetivo,
              id: String(doc.objetivo._id),
            }
          : null,
        // Solo incluir información esencial de sincronización
        isGoogleTasksEnabled: doc.googleTasksSync?.enabled || false,
        googleTasksSyncStatus: doc.googleTasksSync?.syncStatus || null
        // Remover googleTaskId para reducir tamaño de respuesta
      }));

      res.json({
        ...result,
        docs: transformedDocs,
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const tareasController = new TareasController(); 