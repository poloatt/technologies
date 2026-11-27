import { Contactos } from '../models/Contactos.js';
import { Transacciones } from '../models/Transacciones.js';
import {
  limpiarNombreContraparte,
  MP_DOLARES_KINDS,
  MP_INVERSIONES_LEDGER_KINDS,
} from './mercadoPagoUtils.js';
import { esCategoriaValida } from '../utils/categoriasTransaccion.js';

const EXCLUDED_CONTACT_KINDS = new Set([
  'INTERNAL',
  ...MP_INVERSIONES_LEDGER_KINDS,
  ...MP_DOLARES_KINDS,
]);

const SYNTHETIC_NAME_RE = /^(?:comercio\s+#\d+|cuenta\s+\S+)$/i;

/**
 * Textos genéricos que Mercado Pago devuelve como título de ítem cuando el cobro
 * no tiene descripción real (p.ej. "default item"). Si se usaran como nombre o alias,
 * todos esos pagos se unificarían en un mismo contacto.
 */
const NOMBRES_GENERICOS_RE =
  /^(?:default\s+item|items?|producto(?:\s+sin\s+descripci[oó]n)?|pago|compra|payment|sin\s+descripci[oó]n|n\/?a|null|undefined|mercado\s*pago|mercadopago)$/i;

const PREFIX_STRIP_RE =
  /^(?:mercadopago\s*-\s*)?(?:transferencia\s+(?:a|de|para|recibida\s+de|enviada\s+a)|pago\s+(?:a|en|de|con\s+qr\s+en|qr\s+en)|compra\s+(?:en|con\s+tarjeta\s+en)|env[ií]o\s+de\s+dinero\s+(?:a|de)|dinero\s+recibido\s+de|cobro\s+(?:a|de)|retiro\s+a|ingreso\s+de)\s+/i;

const SUFFIX_STRIP_RE = /\s*(?:·\s*desde\s+.+|\s+-\s*(?:cvu|cbu|alias).*)$/i;

// Marca que MP antepone a la descripción ("MercadoPago - Producto de X")
const BRAND_PREFIX_RE = /^mercadopago\s*-\s*/i;

export function normalizarMetadata(metadata) {
  if (!metadata) return {};
  if (metadata instanceof Map) return Object.fromEntries(metadata.entries());
  if (typeof metadata.toObject === 'function') return metadata.toObject();
  return typeof metadata === 'object' ? { ...metadata } : {};
}

export function esNombreSintetico(nombre) {
  if (!nombre) return false;
  return SYNTHETIC_NAME_RE.test(String(nombre).trim());
}

export function esNombreGenerico(nombre) {
  if (!nombre) return true;
  return NOMBRES_GENERICOS_RE.test(String(nombre).trim());
}

/**
 * Normaliza un texto para usarlo como clave de matching/alias:
 * minúsculas, sin tildes, sin prefijos de MP y espacios colapsados.
 */
export function normalizarClaveContacto(texto) {
  if (!texto) return '';
  let s = String(texto).trim();
  if (!s) return '';
  s = s.replace(SUFFIX_STRIP_RE, '').trim();
  // Quitar prefijos reiterados (p.ej. "MercadoPago - Transferencia a ...")
  let prev = null;
  while (prev !== s) {
    prev = s;
    s = s.replace(BRAND_PREFIX_RE, '').trim();
    s = s.replace(PREFIX_STRIP_RE, '').trim();
  }
  s = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@._\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export function normalizarEmail(email) {
  if (!email) return '';
  const cleaned = String(email).trim().toLowerCase();
  return cleaned.includes('@') ? cleaned : '';
}

export function normalizarCuentaBancaria(valor) {
  if (!valor) return '';
  const cleaned = String(valor)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return cleaned.length >= 6 ? cleaned : '';
}

export function normalizarMpId(valor) {
  if (valor == null) return '';
  const cleaned = String(valor).trim();
  if (!cleaned || cleaned === 'null' || cleaned === 'undefined') return '';
  return cleaned;
}

function dedupePush(arr, value) {
  if (!value) return false;
  if (arr.includes(value)) return false;
  arr.push(value);
  return true;
}

function parseRawMetadata(raw) {
  const m = raw?.METADATA ?? raw?.metadata;
  if (!m) return {};
  if (typeof m === 'object') return m;
  if (typeof m === 'string') {
    try {
      const parsed = JSON.parse(m);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function limpiarCandidatoNombre(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  if (!str) return null;
  str = str.replace(SUFFIX_STRIP_RE, '').trim();
  let prev = null;
  while (prev !== str) {
    prev = str;
    str = str.replace(BRAND_PREFIX_RE, '').trim();
    str = str.replace(PREFIX_STRIP_RE, '').trim();
  }
  const limpio = limpiarNombreContraparte(str);
  if (!limpio || esNombreGenerico(limpio)) return null;
  return limpio;
}

/**
 * Extrae las señales identificadoras de una contraparte a partir de metadata/movimiento MP.
 * Devuelve null si el movimiento es interno, de reserva/inversión/dólares o sin contraparte válida.
 */
export function extraerSenalesContraparteMp({ metadata, descripcion, economic, raw } = {}) {
  const meta = normalizarMetadata(metadata);
  const movementKind = economic?.movementKind || meta.movementKind || null;

  if (economic?.isInternal || meta.isInternal) return null;
  if (movementKind && EXCLUDED_CONTACT_KINDS.has(movementKind)) return null;
  // statsExclude solo se permite para compras con tarjeta (tienen comercio real)
  if ((economic?.statsExclude || meta.statsExclude) && movementKind !== 'CARD_PURCHASE') {
    return null;
  }

  const rawMeta = parseRawMetadata(raw);

  const mpId = normalizarMpId(meta.counterpartyId);
  const email = normalizarEmail(meta.counterpartyEmail || rawMeta.counterpart_email || raw?.COUNTERPART_EMAIL);
  const cuentaBancaria = normalizarCuentaBancaria(
    rawMeta.cbu ||
    rawMeta.cvu ||
    rawMeta.bank_account ||
    rawMeta.account_number ||
    raw?.BANK_ACCOUNT ||
    raw?.bank_account ||
    meta.cbu ||
    meta.cvu ||
    meta.bankAccount
  );

  const rawCandidates = [
    meta.counterpartyName,
    meta.businessName,
    meta.statementDescriptor,
    rawMeta.counterparty_name,
    rawMeta.destination_name,
    rawMeta.holder_name,
    rawMeta.counterpart_name,
    raw?.COUNTERPART_NAME,
    raw?.counterpart_name,
    meta.itemTitle,
    descripcion,
  ];

  const nombresReales = [];
  const nombresSinteticos = [];

  for (const candidate of rawCandidates) {
    const cleaned = limpiarCandidatoNombre(candidate);
    if (!cleaned) continue;
    if (esNombreSintetico(cleaned)) {
      if (!nombresSinteticos.includes(cleaned)) nombresSinteticos.push(cleaned);
    } else if (!nombresReales.includes(cleaned)) {
      nombresReales.push(cleaned);
    }
  }

  let nombre = nombresReales[0] || nombresSinteticos[0] || null;
  if (!nombre && mpId) nombre = `Comercio #${mpId}`;
  if (!nombre && cuentaBancaria) nombre = `Cuenta ${cuentaBancaria}`;
  if (!nombre && email) nombre = email;

  if (!nombre && !mpId && !email && !cuentaBancaria) return null;

  const aliases = [];
  for (const n of nombresReales) {
    const key = normalizarClaveContacto(n);
    if (key && key.length >= 2) dedupePush(aliases, key);
  }
  const rawAlias = normalizarClaveContacto(rawMeta.alias);
  if (rawAlias && rawAlias.length >= 2 && !esNombreGenerico(rawAlias)) {
    dedupePush(aliases, rawAlias);
  }

  // Inferir tipo de contacto
  let tipo = 'OTRO';
  if (
    meta.businessName ||
    meta.statementDescriptor ||
    movementKind === 'CARD_PURCHASE' ||
    (movementKind === 'PAYMENT' && !meta.isTransfer)
  ) {
    tipo = 'COMERCIO';
  } else if (
    movementKind === 'P2P_TRANSFER' ||
    movementKind === 'EXTERNAL_TRANSFER' ||
    meta.isTransfer ||
    email
  ) {
    tipo = 'PERSONA';
  }

  return {
    nombre,
    tipo,
    mpId: mpId || null,
    email: email || null,
    cuentaBancaria: cuentaBancaria || null,
    aliases,
  };
}

/**
 * Resuelve la categoría configurada en un contacto para un tipo de transacción.
 * Prioriza el override específico (categoriaIngreso / categoriaEgreso) y luego categoriaDefault.
 */
export function resolverCategoriaDeContacto(contacto, tipoTransaccion) {
  if (!contacto) return null;
  const override =
    tipoTransaccion === 'INGRESO'
      ? contacto.categoriaIngreso
      : tipoTransaccion === 'EGRESO'
        ? contacto.categoriaEgreso
        : null;
  if (override && esCategoriaValida(override)) return override;
  if (contacto.categoriaDefault && esCategoriaValida(contacto.categoriaDefault)) {
    return contacto.categoriaDefault;
  }
  return null;
}

export function createContactoSyncCache() {
  const byKey = new Map();
  const byId = new Map();

  function index(contacto) {
    if (!contacto) return;
    const id = String(contacto._id || contacto.id);
    if (id) byId.set(id, contacto);
    const ids = contacto.identificadores || {};
    for (const v of ids.mpIds || []) byKey.set(`mpId:${v}`, contacto);
    for (const v of ids.emails || []) byKey.set(`email:${v}`, contacto);
    for (const v of ids.cuentasBancarias || []) byKey.set(`bank:${v}`, contacto);
    for (const v of ids.aliases || []) byKey.set(`alias:${v}`, contacto);
  }

  function lookup(senales) {
    if (senales.mpId && byKey.has(`mpId:${senales.mpId}`)) {
      return byKey.get(`mpId:${senales.mpId}`);
    }
    if (senales.email && byKey.has(`email:${senales.email}`)) {
      return byKey.get(`email:${senales.email}`);
    }
    if (senales.cuentaBancaria && byKey.has(`bank:${senales.cuentaBancaria}`)) {
      return byKey.get(`bank:${senales.cuentaBancaria}`);
    }
    for (const alias of senales.aliases || []) {
      if (byKey.has(`alias:${alias}`)) return byKey.get(`alias:${alias}`);
    }
    return null;
  }

  return { index, lookup, byId };
}

async function buscarContactoEnDb(usuarioId, senales, Model = Contactos) {
  if (senales.mpId) {
    const found = await Model.findOne({ usuario: usuarioId, 'identificadores.mpIds': senales.mpId });
    if (found) return found;
  }
  if (senales.email) {
    const found = await Model.findOne({ usuario: usuarioId, 'identificadores.emails': senales.email });
    if (found) return found;
  }
  if (senales.cuentaBancaria) {
    const found = await Model.findOne({
      usuario: usuarioId,
      'identificadores.cuentasBancarias': senales.cuentaBancaria,
    });
    if (found) return found;
  }
  if (senales.aliases?.length) {
    const found = await Model.findOne({
      usuario: usuarioId,
      'identificadores.aliases': { $in: senales.aliases },
    });
    if (found) return found;
  }
  return null;
}

/**
 * Busca un Contacto existente por prioridad (mpId -> email -> cuentaBancaria -> alias)
 * o auto-crea uno nuevo (origen: MERCADOPAGO, categoriaDefault: null).
 * Enriquecerá identificadores y mejorará nombres sintéticos si aparecen datos más ricos.
 */
export async function resolverOCrearContactoMp({
  usuarioId,
  senales,
  cache = null,
  Model = Contactos,
} = {}) {
  if (!usuarioId || !senales) return { contacto: null, creado: false };

  let contacto = cache?.lookup(senales) || null;
  if (!contacto) {
    contacto = await buscarContactoEnDb(usuarioId, senales, Model);
  }

  if (contacto) {
    let dirty = false;
    if (!contacto.identificadores) {
      contacto.identificadores = { mpIds: [], emails: [], cuentasBancarias: [], aliases: [] };
      dirty = true;
    }
    const ids = contacto.identificadores;
    if (dedupePush(ids.mpIds, senales.mpId)) dirty = true;
    if (dedupePush(ids.emails, senales.email)) dirty = true;
    if (dedupePush(ids.cuentasBancarias, senales.cuentaBancaria)) dirty = true;
    for (const alias of senales.aliases || []) {
      if (dedupePush(ids.aliases, alias)) dirty = true;
    }

    if (senales.nombre && !esNombreSintetico(senales.nombre) && esNombreSintetico(contacto.nombre)) {
      contacto.nombre = senales.nombre;
      dirty = true;
    }
    if (senales.email && !contacto.datosContacto?.email) {
      contacto.datosContacto = { ...(contacto.datosContacto || {}), email: senales.email };
      dirty = true;
    }
    if (contacto.tipo === 'OTRO' && senales.tipo && senales.tipo !== 'OTRO') {
      contacto.tipo = senales.tipo;
      dirty = true;
    }

    if (dirty && typeof contacto.save === 'function') {
      await contacto.save();
    }
    cache?.index(contacto);
    return { contacto, creado: false };
  }

  const nuevo = new Model({
    usuario: usuarioId,
    nombre: senales.nombre,
    tipo: senales.tipo || 'OTRO',
    categoriaDefault: null,
    categoriaIngreso: null,
    categoriaEgreso: null,
    identificadores: {
      mpIds: senales.mpId ? [senales.mpId] : [],
      emails: senales.email ? [senales.email] : [],
      cuentasBancarias: senales.cuentaBancaria ? [senales.cuentaBancaria] : [],
      aliases: [...(senales.aliases || [])],
    },
    datosContacto: {
      email: senales.email || '',
      telefono: '',
      notas: '',
    },
    origen: 'MERCADOPAGO',
    activo: true,
  });

  await nuevo.save();
  cache?.index(nuevo);
  return { contacto: nuevo, creado: true };
}

/**
 * Aplica retroactivamente la(s) categoría(s) de un contacto a sus transacciones vinculadas.
 * Respeta `categoriaManual: true` salvo que `sobrescribirManuales` sea `true`.
 */
export async function aplicarCategoriaDeContactoATransacciones(
  contacto,
  { usuarioId, sobrescribirManuales = false, TxModel = Transacciones } = {}
) {
  if (!contacto) return 0;
  const uid = usuarioId || contacto.usuario;
  const contactoId = contacto._id || contacto.id;
  if (!uid || !contactoId) return 0;

  const catIngreso = resolverCategoriaDeContacto(contacto, 'INGRESO');
  const catEgreso = resolverCategoriaDeContacto(contacto, 'EGRESO');
  if (!catIngreso && !catEgreso) return 0;

  const baseFilter = {
    usuario: uid,
    contacto: contactoId,
    ...(sobrescribirManuales ? {} : { categoriaManual: { $ne: true } }),
  };

  let totalActualizadas = 0;

  if (catIngreso && catEgreso && catIngreso === catEgreso) {
    const res = await TxModel.updateMany(
      { ...baseFilter, categoria: { $ne: catIngreso } },
      { $set: { categoria: catIngreso, categoriaManual: false } }
    );
    totalActualizadas += res.modifiedCount || 0;
  } else {
    if (catIngreso) {
      const res = await TxModel.updateMany(
        { ...baseFilter, tipo: 'INGRESO', categoria: { $ne: catIngreso } },
        { $set: { categoria: catIngreso, categoriaManual: false } }
      );
      totalActualizadas += res.modifiedCount || 0;
    }
    if (catEgreso) {
      const res = await TxModel.updateMany(
        { ...baseFilter, tipo: 'EGRESO', categoria: { $ne: catEgreso } },
        { $set: { categoria: catEgreso, categoriaManual: false } }
      );
      totalActualizadas += res.modifiedCount || 0;
    }
  }

  return totalActualizadas;
}

/**
 * Escanea transacciones existentes de Mercado Pago del usuario sin `contacto`,
 * resuelve/auto-crea sus contactos, los vincula y aplica categoría si corresponde.
 */
export async function backfillContactosDesdeMp(
  usuarioId,
  { TxModel = Transacciones, ContactoModel = Contactos } = {}
) {
  const cache = createContactoSyncCache();
  // Precargar contactos existentes del usuario para evitar queries por cada transacción
  const existentes = await ContactoModel.find({ usuario: usuarioId });
  for (const c of existentes) cache.index(c);

  const transacciones = await TxModel.find({
    usuario: usuarioId,
    contacto: null,
    'origen.tipo': { $in: ['MERCADOPAGO', 'MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'] },
  }).select('_id descripcion tipo categoria categoriaManual origen contacto');

  let procesadas = 0;
  let contactosCreados = 0;
  let vinculadas = 0;
  let categorizadas = 0;

  for (const tx of transacciones) {
    procesadas++;
    const senales = extraerSenalesContraparteMp({
      metadata: tx.origen?.metadata,
      descripcion: tx.descripcion,
    });
    if (!senales) continue;

    const { contacto, creado } = await resolverOCrearContactoMp({
      usuarioId,
      senales,
      cache,
      Model: ContactoModel,
    });
    if (creado) contactosCreados++;
    if (!contacto) continue;

    const update = { contacto: contacto._id };
    if (tx.categoria === 'Otro' && !tx.categoriaManual) {
      const catContacto = resolverCategoriaDeContacto(contacto, tx.tipo);
      if (catContacto && catContacto !== 'Otro') {
        update.categoria = catContacto;
        categorizadas++;
      }
    }

    await TxModel.updateOne({ _id: tx._id }, { $set: update });
    vinculadas++;
  }

  return { procesadas, contactosCreados, vinculadas, categorizadas };
}
