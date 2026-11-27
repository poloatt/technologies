import mongoose from 'mongoose';
import { Contactos, Transacciones } from '../models/index.js';
import { TIPOS_CONTACTO } from '../models/Contactos.js';
import { esCategoriaValida } from '../utils/categoriasTransaccion.js';
import { clampPagination } from '../utils/transaccionManual.js';
import {
  aplicarCategoriaDeContactoATransacciones,
  backfillContactosDesdeMp,
  normalizarClaveContacto,
  normalizarCuentaBancaria,
  normalizarEmail,
  normalizarMpId,
} from '../services/contactoResolverService.js';

function dedupeStrings(arr = []) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function normalizarCategoriaNullable(valor) {
  if (valor === undefined) return { provided: false, value: undefined };
  if (valor === null || valor === '') return { provided: true, value: null };
  if (!esCategoriaValida(valor)) return { provided: true, error: `Categoría no válida: ${valor}` };
  return { provided: true, value: valor };
}

function normalizarIdentificadoresInput(input = {}, nombre = '') {
  const mpIds = dedupeStrings((input.mpIds || []).map(normalizarMpId));
  const emails = dedupeStrings((input.emails || []).map(normalizarEmail));
  const cuentasBancarias = dedupeStrings(
    (input.cuentasBancarias || []).map(normalizarCuentaBancaria)
  );
  const aliases = dedupeStrings([
    ...(input.aliases || []).map(normalizarClaveContacto),
    normalizarClaveContacto(nombre),
  ]).filter((a) => a.length >= 2);

  return { mpIds, emails, cuentasBancarias, aliases };
}

async function obtenerStatsPorContacto(usuarioId, contactoIds = []) {
  if (!contactoIds.length) return new Map();
  const objectIds = contactoIds.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await Transacciones.aggregate([
    {
      $match: {
        usuario: new mongoose.Types.ObjectId(usuarioId),
        contacto: { $in: objectIds },
      },
    },
    {
      $group: {
        _id: '$contacto',
        transaccionesCount: { $sum: 1 },
        pendientesCategorizarCount: {
          $sum: {
            $cond: [{ $eq: ['$categoria', 'Otro'] }, 1, 0],
          },
        },
        ultimaFecha: { $max: '$fecha' },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), {
      transaccionesCount: row.transaccionesCount || 0,
      pendientesCategorizarCount: row.pendientesCategorizarCount || 0,
      ultimaFecha: row.ultimaFecha || null,
    });
  }
  return map;
}

class ContactosController {
  async buscarPropio(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'ID de contacto inválido' });
      return null;
    }
    const contacto = await Contactos.findOne({ _id: id, usuario: req.user.id });
    if (!contacto) {
      res.status(404).json({ message: 'Contacto no encontrado' });
      return null;
    }
    return contacto;
  }

  // GET /api/contactos
  getAll = async (req, res) => {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sinCategoria,
        tipo,
        origen,
        sort = 'nombre',
      } = req.query;

      const baseQuery = { usuario: req.user.id, activo: { $ne: false } };
      const query = { ...baseQuery };

      if (tipo && TIPOS_CONTACTO.includes(tipo)) {
        query.tipo = tipo;
      }
      if (origen === 'MANUAL' || origen === 'MERCADOPAGO') {
        query.origen = origen;
      }
      if (sinCategoria === 'true') {
        query.categoriaDefault = null;
        query.categoriaIngreso = null;
        query.categoriaEgreso = null;
      } else if (sinCategoria === 'false') {
        query.$or = [
          { categoriaDefault: { $ne: null } },
          { categoriaIngreso: { $ne: null } },
          { categoriaEgreso: { $ne: null } },
        ];
      }

      const trimmedSearch = String(search || '').trim();
      if (trimmedSearch) {
        const normalizedKey = normalizarClaveContacto(trimmedSearch);
        const escapedRaw = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedNorm = normalizedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchOr = [
          { nombre: { $regex: escapedRaw, $options: 'i' } },
          { 'datosContacto.email': { $regex: escapedRaw, $options: 'i' } },
          { 'identificadores.emails': { $regex: escapedRaw, $options: 'i' } },
          { 'identificadores.mpIds': { $regex: escapedRaw, $options: 'i' } },
          { 'identificadores.cuentasBancarias': { $regex: escapedRaw, $options: 'i' } },
        ];
        if (escapedNorm) {
          searchOr.push({ 'identificadores.aliases': { $regex: escapedNorm, $options: 'i' } });
        }
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: searchOr }];
          delete query.$or;
        } else {
          query.$or = searchOr;
        }
      }

      const { page: pageNum, limit: limitNum } = clampPagination(
        { page, limit },
        { defaultLimit: 100, maxLimit: 500 }
      );

      const [result, totalCount, sinCategoriaCount] = await Promise.all([
        Contactos.paginate(query, {
          page: pageNum,
          limit: limitNum,
          sort,
          lean: true,
          leanWithId: true,
        }),
        Contactos.countDocuments(baseQuery),
        Contactos.countDocuments({
          ...baseQuery,
          categoriaDefault: null,
          categoriaIngreso: null,
          categoriaEgreso: null,
        }),
      ]);

      const statsMap = await obtenerStatsPorContacto(
        req.user.id,
        result.docs.map((d) => d._id)
      );

      const docs = result.docs.map((doc) => {
        const id = doc._id.toString();
        const stats = statsMap.get(id) || {
          transaccionesCount: 0,
          pendientesCategorizarCount: 0,
          ultimaFecha: null,
        };
        return {
          ...doc,
          id,
          ...stats,
        };
      });

      return res.json({
        ...result,
        docs,
        summary: {
          totalCount,
          sinCategoriaCount,
        },
      });
    } catch (error) {
      console.error('Error en getAll contactos:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // GET /api/contactos/:id
  getById = async (req, res) => {
    try {
      const contacto = await this.buscarPropio(req, res);
      if (!contacto) return undefined;
      const statsMap = await obtenerStatsPorContacto(req.user.id, [contacto._id]);
      const stats = statsMap.get(String(contacto._id)) || {
        transaccionesCount: 0,
        pendientesCategorizarCount: 0,
        ultimaFecha: null,
      };
      return res.json({
        ...contacto.toJSON(),
        ...stats,
      });
    } catch (error) {
      console.error('Error en getById contacto:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // GET /api/contactos/:id/transacciones
  getTransacciones = async (req, res) => {
    try {
      const contacto = await this.buscarPropio(req, res);
      if (!contacto) return undefined;

      const { page = 1, limit = 50 } = req.query;
      const pagination = clampPagination({ page, limit }, { defaultLimit: 50, maxLimit: 200 });
      const result = await Transacciones.paginate(
        { usuario: req.user.id, contacto: contacto._id },
        {
          ...pagination,
          sort: { fecha: -1, _id: -1 },
          populate: ['moneda', 'cuenta'],
          lean: true,
          leanWithId: true,
        }
      );

      return res.json({
        ...result,
        docs: result.docs.map((doc) => ({
          ...doc,
          id: doc._id.toString(),
          moneda: doc.moneda ? { ...doc.moneda, id: doc.moneda._id.toString() } : null,
          cuenta: doc.cuenta ? { ...doc.cuenta, id: doc.cuenta._id.toString() } : null,
        })),
      });
    } catch (error) {
      console.error('Error en getTransacciones contacto:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // POST /api/contactos
  create = async (req, res) => {
    try {
      const body = req.body || {};
      const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
      if (!nombre) {
        return res.status(400).json({ message: 'El nombre del contacto es obligatorio' });
      }

      const tipo = TIPOS_CONTACTO.includes(body.tipo) ? body.tipo : 'OTRO';
      const catDef = normalizarCategoriaNullable(body.categoriaDefault);
      const catIng = normalizarCategoriaNullable(body.categoriaIngreso);
      const catEgr = normalizarCategoriaNullable(body.categoriaEgreso);
      for (const c of [catDef, catIng, catEgr]) {
        if (c.error) return res.status(400).json({ message: c.error });
      }

      const identificadores = normalizarIdentificadoresInput(body.identificadores, nombre);
      if (body.datosContacto?.email) {
        const normEmail = normalizarEmail(body.datosContacto.email);
        if (normEmail && !identificadores.emails.includes(normEmail)) {
          identificadores.emails.push(normEmail);
        }
      }

      const contacto = new Contactos({
        usuario: req.user.id,
        nombre,
        tipo,
        categoriaDefault: catDef.provided ? catDef.value : null,
        categoriaIngreso: catIng.provided ? catIng.value : null,
        categoriaEgreso: catEgr.provided ? catEgr.value : null,
        identificadores,
        datosContacto: {
          telefono: String(body.datosContacto?.telefono || '').trim(),
          email: String(body.datosContacto?.email || '').trim(),
          notas: String(body.datosContacto?.notas || '').trim(),
        },
        origen: 'MANUAL',
        activo: true,
      });

      await contacto.save();
      return res.status(201).json({
        ...contacto.toJSON(),
        transaccionesCount: 0,
        pendientesCategorizarCount: 0,
        ultimaFecha: null,
      });
    } catch (error) {
      console.error('Error al crear contacto:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // PUT /api/contactos/:id
  update = async (req, res) => {
    try {
      const contacto = await this.buscarPropio(req, res);
      if (!contacto) return undefined;

      const body = req.body || {};

      if (body.nombre !== undefined) {
        const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
        if (!nombre) {
          return res.status(400).json({ message: 'El nombre del contacto es obligatorio' });
        }
        contacto.nombre = nombre;
      }

      if (body.tipo !== undefined) {
        if (!TIPOS_CONTACTO.includes(body.tipo)) {
          return res.status(400).json({ message: 'Tipo de contacto no válido' });
        }
        contacto.tipo = body.tipo;
      }

      const catDef = normalizarCategoriaNullable(body.categoriaDefault);
      const catIng = normalizarCategoriaNullable(body.categoriaIngreso);
      const catEgr = normalizarCategoriaNullable(body.categoriaEgreso);
      for (const c of [catDef, catIng, catEgr]) {
        if (c.error) return res.status(400).json({ message: c.error });
      }
      if (catDef.provided) contacto.categoriaDefault = catDef.value;
      if (catIng.provided) contacto.categoriaIngreso = catIng.value;
      if (catEgr.provided) contacto.categoriaEgreso = catEgr.value;

      if (body.identificadores !== undefined) {
        contacto.identificadores = normalizarIdentificadoresInput(
          body.identificadores,
          contacto.nombre
        );
      } else if (body.nombre !== undefined) {
        const aliasNombre = normalizarClaveContacto(contacto.nombre);
        if (
          aliasNombre.length >= 2 &&
          !(contacto.identificadores?.aliases || []).includes(aliasNombre)
        ) {
          contacto.identificadores = {
            mpIds: contacto.identificadores?.mpIds || [],
            emails: contacto.identificadores?.emails || [],
            cuentasBancarias: contacto.identificadores?.cuentasBancarias || [],
            aliases: [...(contacto.identificadores?.aliases || []), aliasNombre],
          };
        }
      }

      if (body.datosContacto !== undefined) {
        contacto.datosContacto = {
          telefono: String(body.datosContacto?.telefono ?? contacto.datosContacto?.telefono ?? '').trim(),
          email: String(body.datosContacto?.email ?? contacto.datosContacto?.email ?? '').trim(),
          notas: String(body.datosContacto?.notas ?? contacto.datosContacto?.notas ?? '').trim(),
        };
        const normEmail = normalizarEmail(contacto.datosContacto.email);
        if (normEmail && !(contacto.identificadores?.emails || []).includes(normEmail)) {
          contacto.identificadores.emails.push(normEmail);
        }
      }

      if (body.activo !== undefined) {
        contacto.activo = Boolean(body.activo);
      }

      await contacto.save();

      let transaccionesActualizadas = 0;
      if (body.aplicarRetroactivo) {
        transaccionesActualizadas = await aplicarCategoriaDeContactoATransacciones(contacto, {
          usuarioId: req.user.id,
          sobrescribirManuales: Boolean(body.sobrescribirManuales),
        });
      }

      const statsMap = await obtenerStatsPorContacto(req.user.id, [contacto._id]);
      const stats = statsMap.get(String(contacto._id)) || {
        transaccionesCount: 0,
        pendientesCategorizarCount: 0,
        ultimaFecha: null,
      };

      return res.json({
        ...contacto.toJSON(),
        ...stats,
        transaccionesActualizadas,
      });
    } catch (error) {
      console.error('Error al actualizar contacto:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // POST /api/contactos/:id/aplicar-categoria
  aplicarCategoria = async (req, res) => {
    try {
      const contacto = await this.buscarPropio(req, res);
      if (!contacto) return undefined;

      const transaccionesActualizadas = await aplicarCategoriaDeContactoATransacciones(contacto, {
        usuarioId: req.user.id,
        sobrescribirManuales: Boolean(req.body?.sobrescribirManuales),
      });

      return res.json({
        contactoId: contacto.id,
        transaccionesActualizadas,
      });
    } catch (error) {
      console.error('Error al aplicar categoría retroactiva:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // POST /api/contactos/:id/merge
  merge = async (req, res) => {
    try {
      const target = await this.buscarPropio(req, res);
      if (!target) return undefined;

      const rawIds = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds : [];
      const sourceIds = dedupeStrings(
        rawIds
          .map((id) => String(id || '').trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== String(target._id))
      );

      if (!sourceIds.length) {
        return res.status(400).json({ message: 'Debe indicar al menos un contacto origen para fusionar' });
      }

      const sources = await Contactos.find({
        _id: { $in: sourceIds },
        usuario: req.user.id,
      });

      if (!sources.length) {
        return res.status(404).json({ message: 'No se encontraron contactos origen válidos' });
      }

      const mpIds = [...(target.identificadores?.mpIds || [])];
      const emails = [...(target.identificadores?.emails || [])];
      const cuentasBancarias = [...(target.identificadores?.cuentasBancarias || [])];
      const aliases = [...(target.identificadores?.aliases || [])];

      for (const src of sources) {
        for (const v of src.identificadores?.mpIds || []) mpIds.push(v);
        for (const v of src.identificadores?.emails || []) emails.push(v);
        for (const v of src.identificadores?.cuentasBancarias || []) cuentasBancarias.push(v);
        for (const v of src.identificadores?.aliases || []) aliases.push(v);
        const srcAlias = normalizarClaveContacto(src.nombre);
        if (srcAlias.length >= 2) aliases.push(srcAlias);
        if (!target.datosContacto?.email && src.datosContacto?.email) {
          target.datosContacto.email = src.datosContacto.email;
        }
        if (!target.datosContacto?.telefono && src.datosContacto?.telefono) {
          target.datosContacto.telefono = src.datosContacto.telefono;
        }
      }

      target.identificadores = {
        mpIds: dedupeStrings(mpIds),
        emails: dedupeStrings(emails),
        cuentasBancarias: dedupeStrings(cuentasBancarias),
        aliases: dedupeStrings(aliases),
      };
      await target.save();

      const validSourceObjectIds = sources.map((s) => s._id);
      const reassignResult = await Transacciones.updateMany(
        { usuario: req.user.id, contacto: { $in: validSourceObjectIds } },
        { $set: { contacto: target._id } }
      );

      await Contactos.deleteMany({ _id: { $in: validSourceObjectIds }, usuario: req.user.id });

      let transaccionesActualizadas = 0;
      if (req.body?.aplicarRetroactivo) {
        transaccionesActualizadas = await aplicarCategoriaDeContactoATransacciones(target, {
          usuarioId: req.user.id,
          sobrescribirManuales: Boolean(req.body?.sobrescribirManuales),
        });
      }

      const statsMap = await obtenerStatsPorContacto(req.user.id, [target._id]);
      const stats = statsMap.get(String(target._id)) || {
        transaccionesCount: 0,
        pendientesCategorizarCount: 0,
        ultimaFecha: null,
      };

      return res.json({
        ...target.toJSON(),
        ...stats,
        fusionados: sources.length,
        transaccionesReasignadas: reassignResult.modifiedCount || 0,
        transaccionesActualizadas,
      });
    } catch (error) {
      console.error('Error al fusionar contactos:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // POST /api/contactos/backfill-mp
  backfillMp = async (req, res) => {
    try {
      const stats = await backfillContactosDesdeMp(req.user.id);
      return res.json(stats);
    } catch (error) {
      console.error('Error en backfill-mp contactos:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // DELETE /api/contactos/:id
  delete = async (req, res) => {
    try {
      const contacto = await this.buscarPropio(req, res);
      if (!contacto) return undefined;

      await Transacciones.updateMany(
        { usuario: req.user.id, contacto: contacto._id },
        { $set: { contacto: null } }
      );
      await Contactos.deleteOne({ _id: contacto._id, usuario: req.user.id });

      return res.json({ message: 'Contacto eliminado', id: contacto.id });
    } catch (error) {
      console.error('Error al eliminar contacto:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

export const contactosController = new ContactosController();
