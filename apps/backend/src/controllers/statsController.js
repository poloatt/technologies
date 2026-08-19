import {
  Transacciones,
  Cuentas,
  Monedas,
  Propiedades,
  Inquilinos,
  Contratos,
  Inventarios,
  TransaccionRecurrente,
} from '../models/index.js';

/**
 * Registro de recursos contables para el endpoint batch de counts.
 * La clave coincide con el id de sección que usa el hub/strip de Caja.
 * `filter` es estático; el filtro por usuario se agrega automáticamente
 * cuando el modelo tiene el path `usuario`.
 */
const COUNT_REGISTRY = {
  transacciones: { Model: Transacciones },
  cuentas: { Model: Cuentas },
  monedas: { Model: Monedas },
  recurrente: { Model: TransaccionRecurrente },
  propiedades: { Model: Propiedades },
  inquilinos: { Model: Inquilinos },
  contratos: { Model: Contratos },
  inventario: { Model: Inventarios },
  'inventario-en-propiedades': {
    Model: Inventarios,
    filter: { propiedad: { $exists: true, $ne: null } },
  },
  'inventario-sin-ubicacion': {
    Model: Inventarios,
    filter: { $or: [{ propiedad: { $exists: false } }, { propiedad: null }] },
  },
};

function buildCountFilter(entry, userId) {
  const filter = { ...(entry.filter || {}) };
  // Acotar por usuario solo si el modelo tiene ese campo (evita contar de más)
  if (userId && entry.Model.schema.path('usuario')) {
    filter.usuario = userId;
  }
  return filter;
}

export const statsController = {
  // GET /api/stats/counts?keys=transacciones,cuentas,monedas
  getCounts: async (req, res) => {
    try {
      const raw = req.query.keys;
      const keys = (Array.isArray(raw) ? raw.join(',') : (raw || ''))
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (keys.length === 0) {
        return res.json({ counts: {} });
      }

      const userId = req.user?.id;
      const uniqueKeys = [...new Set(keys)];

      const entries = await Promise.all(
        uniqueKeys.map(async (key) => {
          const entry = COUNT_REGISTRY[key];
          if (!entry) return [key, null];
          try {
            const count = await entry.Model.countDocuments(buildCountFilter(entry, userId));
            return [key, count];
          } catch (err) {
            console.error(`Error contando recurso "${key}":`, err.message);
            return [key, null];
          }
        }),
      );

      res.json({ counts: Object.fromEntries(entries) });
    } catch (error) {
      console.error('Error en getCounts:', error);
      res.status(500).json({ error: error.message });
    }
  },
};
