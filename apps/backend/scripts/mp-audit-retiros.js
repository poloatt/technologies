#!/usr/bin/env node
/**
 * Auditoría de solo lectura de las salidas a CBU (PAYOUTS / WITHDRAWAL) de Mercado Pago.
 *
 * Descarga los reportes de liquidación "de confianza" (manuales, generados con retiros),
 * toma todos sus retiros y los cruza con el ledger por id. Lista lo que falta por mes.
 * Sale con código 1 si hay faltantes: sirve de chequeo periódico (cron / CI manual).
 *
 *   node scripts/mp-audit-retiros.js                      # primera conexión de Mercado Pago
 *   node scripts/mp-audit-retiros.js --conexion <id>      # una conexión puntual
 *   node scripts/mp-audit-retiros.js --json               # salida JSON (para automatizar)
 *
 * No escribe en la base ni en Mercado Pago, y nunca imprime el token.
 * Requiere MONGO_PUBLIC_URL | MONGO_URL | MONGODB_URI (se lee ../.env.produccion y ../.env).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { BankSyncService } from '../src/services/bankSyncService.js';
import { mpAuthHeaders } from '../src/services/mercadoPagoUtils.js';
import { parseSettlementCsv } from '../src/services/mercadoPagoCsvParser.js';
import {
  conciliarRetiros,
  esReporteConfiable,
  extraerRetiros,
  resumenCoberturaRetiros
} from '../src/services/mercadoPagoRetiros.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.produccion') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const MP_BASE = 'https://api.mercadopago.com';
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const conexionArg = args.includes('--conexion') ? args[args.indexOf('--conexion') + 1] : null;
const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!mongoUrl) {
  console.error('Falta MONGO_PUBLIC_URL, MONGO_URL o MONGODB_URI');
  process.exit(1);
}

const log = (...a) => {
  if (!asJson) console.log(...a);
};

function mesAr(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return 'sin-fecha';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 7);
}

const redondear = (n) => Math.round(n * 100) / 100;

await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;

try {
  const filtro = { tipo: 'MERCADOPAGO' };
  if (conexionArg) filtro._id = new mongoose.Types.ObjectId(conexionArg);
  const conexion = await db.collection('bankconnections').findOne(filtro);
  if (!conexion) {
    console.error('No se encontró una conexión de Mercado Pago');
    process.exit(1);
  }

  const crypt = new BankSyncService();
  const token = crypt.decrypt(conexion.credenciales.accessToken);

  const listRes = await fetch(`${MP_BASE}/v1/account/settlement_report/list`, { headers: mpAuthHeaders(token) });
  if (!listRes.ok) {
    console.error(
      `No se pudo listar reportes (${listRes.status}). Si es 401, corré una sincronización para renovar el token.`
    );
    process.exit(1);
  }
  const listData = await listRes.json();
  const reportes = (Array.isArray(listData) ? listData : listData.results || [])
    .filter((r) => r.file_name && String(r.status || '').toLowerCase() === 'processed')
    .filter((r) => esReporteConfiable(r));

  log(`Reportes de confianza procesados: ${reportes.length}`);

  const porId = new Map();
  for (const r of reportes) {
    const res = await fetch(`${MP_BASE}/v1/account/settlement_report/${encodeURIComponent(r.file_name)}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Attadia/1.0' }
    });
    if (!res.ok) {
      log(`  ! ${r.file_name}: ${res.status}`);
      continue;
    }
    const retiros = extraerRetiros(parseSettlementCsv(await res.text()));
    for (const retiro of retiros) if (!porId.has(retiro.id)) porId.set(retiro.id, retiro);
    log(`  ${r.file_name} (${r.begin_date?.slice(0, 10)} → ${r.end_date?.slice(0, 10)}): ${retiros.length} retiros`);
  }

  const retiros = Array.from(porId.values());
  const ids = retiros.map((r) => r.id);
  const numericos = ids.filter((id) => /^\d+$/.test(id)).map(Number);
  const docs = await db
    .collection('transacciones')
    .find({
      cuenta: conexion.cuenta,
      'origen.tipo': { $in: ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO'] },
      $or: [
        { 'origen.transaccionId': { $in: ids } },
        { 'origen.metadata.paymentId': { $in: [...ids, ...numericos] } }
      ]
    })
    .project({ 'origen.transaccionId': 1, 'origen.metadata.paymentId': 1 })
    .toArray();
  const presentes = new Set();
  for (const d of docs) {
    if (d.origen?.transaccionId) presentes.add(String(d.origen.transaccionId));
    if (d.origen?.metadata?.paymentId) presentes.add(String(d.origen.metadata.paymentId));
  }

  const conciliacion = conciliarRetiros(retiros, presentes);
  const faltantesPorMes = {};
  for (const f of conciliacion.faltantes) {
    const mes = mesAr(f.date);
    faltantesPorMes[mes] ||= { cantidad: 0, monto: 0, ids: [] };
    faltantesPorMes[mes].cantidad += 1;
    if (f.type !== 'WITHDRAWAL_CANCEL') faltantesPorMes[mes].monto = redondear(faltantesPorMes[mes].monto + f.amount);
    faltantesPorMes[mes].ids.push(f.id);
  }

  const cobertura = resumenCoberturaRetiros(conexion.mercadopago || {});
  const salida = {
    conexion: String(conexion._id),
    reportesDeConfianza: reportes.length,
    retirosEnReportes: retiros.length,
    enLedger: conciliacion.conciliados,
    faltantes: conciliacion.faltantes.length,
    montoFaltante: redondear(
      conciliacion.faltantes.filter((f) => f.type !== 'WITHDRAWAL_CANCEL').reduce((s, f) => s + f.amount, 0)
    ),
    faltantesPorMes,
    cobertura: {
      completa: cobertura.completa,
      validadoHasta: cobertura.validadoHasta,
      tramosSinValidar: cobertura.totalTramosSinValidar
    }
  };

  if (asJson) {
    console.log(JSON.stringify(salida, null, 2));
  } else {
    log(`\nRetiros en reportes de confianza: ${salida.retirosEnReportes} | en ledger: ${salida.enLedger} | faltantes: ${salida.faltantes}`);
    if (salida.faltantes) {
      log(`Monto faltante: $${salida.montoFaltante.toLocaleString('es-AR')}`);
      for (const [mes, info] of Object.entries(faltantesPorMes).sort()) {
        log(`  ${mes}: ${info.cantidad} retiros, $${info.monto.toLocaleString('es-AR')}  (ids: ${info.ids.slice(0, 5).join(', ')}${info.ids.length > 5 ? '…' : ''})`);
      }
    }
    log(
      `\nCobertura validada: ${cobertura.completa ? 'completa' : 'INCOMPLETA'}` +
        ` | validado hasta: ${cobertura.validadoHasta || '—'} | tramos sin validar: ${cobertura.totalTramosSinValidar}`
    );
    for (const aviso of cobertura.avisos) log(`  ⚠ ${aviso}`);
    log(
      salida.faltantes === 0 && reportes.length
        ? '\nOK: todas las salidas a CBU de los reportes de confianza están en el ledger.'
        : '\nHay salidas faltantes o no hay reportes de confianza: corré Sincronizar/Histórico y volvé a auditar.'
    );
  }

  process.exitCode = salida.faltantes > 0 || reportes.length === 0 ? 1 : 0;
} finally {
  await mongoose.disconnect();
}
