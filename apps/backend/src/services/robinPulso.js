import mongoose from 'mongoose';
import {
  BODY_ZONES,
  DIET_CHANNELS,
  DIET_SLOTS,
  DIET_UNITS,
  SALUD_ESTADOS,
  SALUD_TIPOS,
} from '@attadia/shared/pulso';
import { ROBIN_ORIGIN } from '../../../robin/src/server/index.js';
import { ControlSalud, DietaPlan, Receta, SaludItem } from '../models/index.js';
import { projectSaludItem } from '../controllers/saludController.js';
import { storeRobinFile } from './robinFiles.js';
import { ORGAN_SECTIONS, MUSCLE_SECTIONS } from '../../../pulso/src/components/data/dataTemplates.js';

const SLOT_IDS = new Set(DIET_SLOTS.map((slot) => slot.id));
const CHANNEL_IDS = new Set(DIET_CHANNELS.map((channel) => channel.id));
const UNIT_IDS = new Set(DIET_UNITS);
const FRANJAS = new Map([
  ['MAÑANA', 'MAÑANA'],
  ['MANANA', 'MAÑANA'],
  ['TARDE', 'TARDE'],
  ['NOCHE', 'NOCHE'],
]);

const BONE_PARTS = [
  ['craneo', 'Cráneo'],
  ['cara', 'Cara'],
  ['dientes', 'Dientes'],
  ['cuello', 'Cuello'],
  ['costillas', 'Costillas'],
  ['columna', 'Columna'],
  ['esternon', 'Esternón'],
  ['clavicula', 'Clavícula'],
  ['escapula', 'Escápula'],
  ['brazo', 'Brazo'],
  ['mano', 'Mano'],
  ['cadera', 'Cadera'],
  ['pierna', 'Pierna'],
  ['pie', 'Pie'],
];

function zoneLabel(zona) {
  return BODY_ZONES.find((zone) => zone.id === zona)?.label || zona;
}

function partLabel(parte) {
  if (!parte) return '';
  for (const section of ORGAN_SECTIONS) {
    const organ = section.organs.find((item) => item.id === parte);
    if (organ) return organ.label;
  }
  for (const section of MUSCLE_SECTIONS) {
    const muscle = section.muscles.find((item) => item.id === parte);
    if (muscle) return muscle.label;
  }
  const bone = BONE_PARTS.find(([id]) => id === parte);
  return bone ? bone[1] : parte;
}

export function bodyCatalog() {
  const lines = ORGAN_SECTIONS.map((section) => (
    `Órganos ${section.label} (zona ${section.zone}): ${section.organs.map((organ) => `${organ.id} ${organ.label}`).join(', ')}`
  ));
  lines.push(...MUSCLE_SECTIONS.map((section) => (
    `Músculos ${section.label} (zona ${section.zone}): ${section.muscles.map((muscle) => `${muscle.id} ${muscle.label}`).join(', ')}`
  )));
  lines.push(`Huesos: ${BONE_PARTS.map(([id, label]) => `${id} ${label}`).join(', ')}`);
  return lines.join('\n');
}

function plain(doc) {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;
  return JSON.parse(JSON.stringify(raw));
}

function recetaBody(receta) {
  const raw = plain(receta) || {};
  return {
    nombre: raw.nombre,
    slot: raw.slot,
    ingredientes: raw.ingredientes || [],
    calorias: raw.calorias || 0,
    proteinas: raw.proteinas || 0,
    carbohidratos: raw.carbohidratos || 0,
    grasas: raw.grasas || 0,
    preparacion: raw.preparacion || '',
    porciones: raw.porciones || 1,
    frecuencia: raw.frecuencia,
    dias: raw.dias || [],
    franjas: raw.franjas || [],
    origen: raw.origen || 'usuario',
  };
}

function saludBody(item) {
  const raw = plain(item) || {};
  return {
    controlId: raw.controlId,
    tipo: raw.tipo,
    titulo: raw.titulo,
    fecha: raw.fecha,
    estado: raw.estado,
    notas: raw.notas || '',
    parte: raw.parte || '',
    origen: raw.origen || 'usuario',
  };
}

function planBody(plan) {
  const raw = plain(plan) || {};
  return {
    calorias: raw.calorias || 0,
    proteinas: raw.proteinas || 0,
    carbohidratos: raw.carbohidratos || 0,
    grasas: raw.grasas || 0,
    cadencia: raw.cadencia || 1,
    frecuencia: raw.frecuencia || 'SEMANAL',
    comidas: raw.comidas || [],
    huecos: raw.huecos || [],
    rotacion: raw.rotacion || [],
    vinculos: raw.vinculos,
    origen: raw.origen || 'usuario',
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactItem(item, zona) {
  return {
    id: String(item._id),
    titulo: item.titulo,
    tipo: item.tipo,
    fecha: item.fecha,
    estado: item.estado,
    parte: item.parte || '',
    zona,
    origen: item.origen || 'usuario',
    notas: String(item.notas || '').slice(0, 500),
    archivos: (item.archivos || []).map((archivo) => archivo.nombre),
  };
}

async function leerSalud(usuario) {
  const [controles, items] = await Promise.all([
    ControlSalud.find({ usuario }).lean(),
    SaludItem.find({ usuario }).sort({ fecha: -1 }).limit(40).lean(),
  ]);
  const zonaDe = new Map(controles.map((control) => [control.controlId, control.zona]));
  return {
    controles: controles.map((control) => ({
      controlId: control.controlId,
      zona: control.zona,
      label: control.label,
      origen: control.origen || 'usuario',
    })),
    items: items.map((item) => compactItem(item, zonaDe.get(item.controlId) || '')),
  };
}

async function controlForZone(usuario, zona) {
  const zone = BODY_ZONES.find((item) => item.id === zona);
  if (!zone) throw new Error('Zona desconocida');
  const existing = await ControlSalud.findOne({ usuario, zona });
  if (existing) return { control: existing, created: false };
  const control = await ControlSalud.create({
    usuario,
    controlId: `robin_${zona}`,
    zona,
    label: zone.label,
    intervaloDias: 365,
    origen: ROBIN_ORIGIN,
  });
  return { control, created: true };
}

function defaultEstado(tipo, estado) {
  if (SALUD_ESTADOS.includes(estado)) return estado;
  if (tipo === 'TURNO' || tipo === 'COPAGO') return 'PENDIENTE';
  return 'HECHO';
}

async function registrarSalud(usuario, input, files) {
  const tipo = SALUD_TIPOS.includes(input.tipo) ? input.tipo : 'ESTUDIO';
  const titulo = String(input.titulo || '').trim();
  if (!titulo) throw new Error('Falta el título');
  const fecha = new Date(input.fecha);
  if (Number.isNaN(fecha.getTime())) throw new Error('Fecha inválida');
  const { control, created } = await controlForZone(usuario, input.zona);
  const indexes = Array.isArray(input.archivos) ? input.archivos : [];
  const archivos = [];
  for (const index of indexes) {
    const file = files[Number(index)];
    if (file) archivos.push(await storeRobinFile(usuario, file));
  }
  const item = await SaludItem.create({
    usuario,
    controlId: control.controlId,
    tipo,
    titulo,
    fecha,
    estado: defaultEstado(tipo, input.estado),
    notas: String(input.notas || ''),
    parte: String(input.parte || '').trim(),
    origen: ROBIN_ORIGIN,
    archivos,
  });
  await projectSaludItem(item, usuario);
  const parte = partLabel(item.parte);
  const place = parte ? `${parte} · ${zoneLabel(input.zona)}` : zoneLabel(input.zona);
  const change = `${titulo} · ${place}`;
  const undos = [];
  if (created) {
    undos.push({
      type: 'CREATE',
      entity: 'salud_control',
      entityId: control.controlId,
      data: { controlId: control.controlId, zona: control.zona, label: control.label },
      originalData: null,
      description: change,
    });
  }
  undos.push({
    type: 'CREATE',
    entity: 'salud_item',
    entityId: String(item._id),
    data: saludBody(item),
    originalData: null,
    description: change,
  });
  return {
    domain: 'salud',
    change,
    undos,
    output: { id: String(item._id), titulo, zona: input.zona, parte: item.parte },
  };
}

async function leerDieta(usuario) {
  const [plan, recetas] = await Promise.all([
    DietaPlan.findOne({ usuario }).lean(),
    Receta.find({ usuario }).sort({ nombre: 1 }).lean(),
  ]);
  return {
    plan: plan ? {
      calorias: plan.calorias,
      proteinas: plan.proteinas,
      carbohidratos: plan.carbohidratos,
      grasas: plan.grasas,
      origen: plan.origen || 'usuario',
    } : null,
    comidas: recetas.map((receta) => ({
      id: String(receta._id),
      nombre: receta.nombre,
      slot: receta.slot,
      frecuencia: receta.frecuencia,
      dias: receta.dias,
      franjas: receta.franjas,
      porciones: receta.porciones,
      ingredientes: receta.ingredientes,
      calorias: receta.calorias,
      proteinas: receta.proteinas,
      carbohidratos: receta.carbohidratos,
      grasas: receta.grasas,
      preparacion: receta.preparacion,
      origen: receta.origen || 'usuario',
    })),
  };
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (Number.isNaN(number) || number < 0) return null;
  return number;
}

function mealPatch(input) {
  const patch = { origen: ROBIN_ORIGIN };
  if (input.nombre != null && String(input.nombre).trim()) {
    patch.nombre = String(input.nombre).trim();
  }
  if (SLOT_IDS.has(input.slot)) patch.slot = input.slot;
  if (input.frecuencia === 'DIARIA' || input.frecuencia === 'SEMANAL') patch.frecuencia = input.frecuencia;
  if (Array.isArray(input.dias)) {
    patch.dias = input.dias.map(Number).filter((day) => day >= 0 && day <= 6);
  }
  if (Array.isArray(input.franjas)) {
    patch.franjas = input.franjas
      .map((franja) => FRANJAS.get(String(franja || '').toUpperCase()))
      .filter(Boolean);
  }
  const porciones = numberOrNull(input.porciones);
  if (porciones != null) patch.porciones = Math.max(1, porciones);
  if (Array.isArray(input.ingredientes)) {
    patch.ingredientes = input.ingredientes
      .filter((item) => item?.nombre && String(item.nombre).trim())
      .map((item) => ({
        nombre: String(item.nombre).trim(),
        canal: CHANNEL_IDS.has(item.canal) ? item.canal : 'super',
        cantidad: numberOrNull(item.cantidad) ?? 1,
        unidad: UNIT_IDS.has(item.unidad) ? item.unidad : 'u',
      }));
  }
  for (const key of ['calorias', 'proteinas', 'carbohidratos', 'grasas']) {
    const value = numberOrNull(input[key]);
    if (value != null) patch[key] = value;
  }
  if (input.preparacion != null) patch.preparacion = String(input.preparacion);
  return patch;
}

function mealChange(receta) {
  const bits = [receta.nombre];
  if (receta.frecuencia === 'DIARIA') bits.push('diaria');
  else if (receta.dias?.length) bits.push(`${receta.dias.length} días`);
  if (receta.calorias) bits.push(`${receta.calorias} kcal`);
  const ingredientes = (receta.ingredientes || []).map((item) => item.nombre).filter(Boolean);
  if (ingredientes.length) bits.push(ingredientes.slice(0, 4).join(', '));
  return bits.join(' · ');
}

async function guardarComida(usuario, input) {
  const patch = mealPatch(input);
  if (!patch.nombre && !input.id) throw new Error('Falta el nombre de la comida');
  let receta = null;
  if (input.id && mongoose.isValidObjectId(input.id)) {
    receta = await Receta.findOne({ _id: input.id, usuario });
  }
  if (!receta && patch.nombre) {
    receta = await Receta.findOne({
      usuario,
      nombre: new RegExp(`^${escapeRegex(patch.nombre)}$`, 'i'),
    });
  }
  const before = receta ? recetaBody(receta) : null;
  if (receta) {
    Object.assign(receta, patch);
    await receta.save();
  } else {
    receta = await Receta.create({
      usuario,
      nombre: patch.nombre,
      slot: patch.slot || 'COMIDA',
      frecuencia: patch.frecuencia || 'SEMANAL',
      dias: patch.dias || [],
      franjas: patch.franjas?.length ? patch.franjas : ['TARDE'],
      porciones: patch.porciones || 1,
      ingredientes: patch.ingredientes || [],
      calorias: patch.calorias || 0,
      proteinas: patch.proteinas || 0,
      carbohidratos: patch.carbohidratos || 0,
      grasas: patch.grasas || 0,
      preparacion: patch.preparacion || '',
      origen: ROBIN_ORIGIN,
    });
  }
  const change = mealChange(receta);
  return {
    domain: 'dieta',
    change,
    undo: {
      type: before ? 'UPDATE' : 'CREATE',
      entity: 'receta',
      entityId: String(receta._id),
      data: recetaBody(receta),
      originalData: before,
      description: change,
    },
    output: { id: String(receta._id), nombre: receta.nombre },
  };
}

async function actualizarPlan(usuario, input) {
  const patch = { origen: ROBIN_ORIGIN };
  for (const key of ['calorias', 'proteinas', 'carbohidratos', 'grasas']) {
    const value = numberOrNull(input[key]);
    if (value != null) patch[key] = value;
  }
  if (Object.keys(patch).length === 1) throw new Error('No hay objetivos para guardar');
  const previous = await DietaPlan.findOne({ usuario });
  const before = planBody(previous);
  const plan = await DietaPlan.findOneAndUpdate(
    { usuario },
    { $set: patch, $setOnInsert: { usuario } },
    { new: true, upsert: true },
  );
  const bits = ['Plan'];
  if (patch.calorias != null) bits.push(`${patch.calorias} kcal`);
  if (patch.proteinas != null) bits.push(`${patch.proteinas} g proteína`);
  if (patch.carbohidratos != null) bits.push(`${patch.carbohidratos} g carb`);
  if (patch.grasas != null) bits.push(`${patch.grasas} g grasa`);
  const change = bits.join(' · ');
  return {
    domain: 'dieta',
    change,
    undo: {
      type: 'UPDATE',
      entity: 'dieta_plan',
      entityId: String(plan._id),
      data: planBody(plan),
      originalData: before,
      description: change,
    },
    output: { id: String(plan._id) },
  };
}

export function createPulsoExecutor({ usuario, files = [] }) {
  return async function executeTool(name, input) {
    if (name === 'leer_salud') {
      return { domain: 'salud', output: await leerSalud(usuario) };
    }
    if (name === 'registrar_salud') {
      return registrarSalud(usuario, input, files);
    }
    if (name === 'leer_dieta') {
      return { domain: 'dieta', output: await leerDieta(usuario) };
    }
    if (name === 'guardar_comida') {
      return guardarComida(usuario, input);
    }
    if (name === 'actualizar_plan') {
      return actualizarPlan(usuario, input);
    }
    throw new Error(`Herramienta desconocida: ${name}`);
  };
}
