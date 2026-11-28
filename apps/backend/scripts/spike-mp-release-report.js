#!/usr/bin/env node

/**
 * Spike del reporte de liberaciones de Mercado Pago (release_report).
 *
 * Objetivo: confirmar con una cuenta real que el reporte trae
 *   - saldo inicial / final y saldo corrido (BALANCE_AMOUNT),
 *   - los retiros a banco con la cuenta destino (PAYOUT_BANK_ACCOUNT_NUMBER),
 *   - el mismo SOURCE_ID que los PAYOUTS del reporte de liquidación (settlement).
 *
 * Uso:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-... node apps/backend/scripts/spike-mp-release-report.js 2026-04-02 2026-05-31
 *   ... --confirmar    Crea la config de release_report y UN reporte en la cuenta de MP (consume cupo).
 *
 * Sin --confirmar solo lee (config y listado) y no crea nada.
 * No toca la base de datos ni imprime el token. El CSV completo se guarda en la carpeta temporal.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { mpAuthHeaders } from '../src/services/mercadoPagoUtils.js';
import { parseSettlementCsv } from '../src/services/mercadoPagoCsvParser.js';
import { extraerRetiros } from '../src/services/mercadoPagoRetiros.js';
import {
  MercadoPagoReleaseReportService,
  parseReleaseCsv,
  validarRangoConRelease,
} from '../src/services/mercadoPagoReleaseReportService.js';

const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const [desde, hasta] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CONFIRMAR = process.argv.includes('--confirmar');

if (!TOKEN) {
  console.error('Falta MERCADOPAGO_ACCESS_TOKEN');
  process.exit(1);
}
if (!desde || !hasta) {
  console.error('Uso: spike-mp-release-report.js <desde YYYY-MM-DD> <hasta YYYY-MM-DD> [--confirmar]');
  process.exit(1);
}

const begin = new Date(`${desde}T00:00:00.000-03:00`).toISOString();
const end = new Date(`${hasta}T23:59:59.000-03:00`).toISOString();
const release = new MercadoPagoReleaseReportService({ accessToken: TOKEN });

async function settlementDelRango() {
  const res = await fetch('https://api.mercadopago.com/v1/account/settlement_report/list', {
    headers: mpAuthHeaders(TOKEN),
  });
  const data = await res.json();
  const lista = Array.isArray(data) ? data : data.results || [];
  const candidato = lista
    .filter((r) => r.created_from === 'manual' && r.status === 'processed')
    .filter((r) => new Date(r.begin_date) <= new Date(begin) && new Date(r.end_date) >= new Date(end) - 864e5)
    .sort((a, b) => String(b.date_created).localeCompare(String(a.date_created)))[0];
  if (!candidato) return null;
  const csv = await (
    await fetch(`https://api.mercadopago.com/v1/account/settlement_report/${encodeURIComponent(candidato.file_name)}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'Attadia/1.0' },
    })
  ).text();
  return { fileName: candidato.file_name, rows: parseSettlementCsv(csv) };
}

async function main() {
  console.log(`Rango: ${begin} → ${end}`);
  console.log('Config release_report actual:', JSON.stringify(await release.getConfig()));
  console.log('Reportes release existentes:', (await release.listReports()).length);

  if (!CONFIRMAR) {
    console.log('\nModo lectura: agregá --confirmar para crear la config y un reporte de prueba.');
    return;
  }

  const resultado = await release.fetchRange(begin, end, { maxPollAttempts: 40, pollIntervalMs: 4000 });
  if (resultado.pending) {
    console.log('Reporte todavía en generación. Reintentá más tarde; id:', resultado.reportId);
    return;
  }

  const salida = path.join(os.tmpdir(), `mp-release-spike-${Date.now()}.json`);
  fs.writeFileSync(salida, JSON.stringify(resultado.rows, null, 1));
  const tipos = {};
  for (const r of resultado.rows) tipos[r.tipo] = (tipos[r.tipo] || 0) + 1;
  console.log('\nArchivo:', resultado.fileName, '| filas:', resultado.rows.length, '| guardado en', salida);
  console.log('Tipos de registro (RECORD_TYPE):', tipos);
  console.log('Con cuenta destino:', resultado.rows.filter((r) => r.cuentaDestino).length);
  console.log('Con saldo corrido:', resultado.rows.filter((r) => r.saldo != null).length);

  const settlement = await settlementDelRango();
  if (!settlement) {
    console.log('\nNo hay reporte de liquidación de confianza que cubra el rango para cruzar.');
    return;
  }
  const retiros = extraerRetiros(settlement.rows).filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= new Date(begin).getTime() && t <= new Date(end).getTime();
  });
  const validacion = validarRangoConRelease({ releaseRows: resultado.rows, retirosSettlement: retiros });
  console.log('\nSettlement:', settlement.fileName, '| retiros en el rango:', retiros.length);
  console.log('Saldo corrido:', JSON.stringify(validacion.saldo));
  console.log(
    'Cruce de retiros:',
    JSON.stringify({
      ok: validacion.cruce.ok,
      pares: validacion.cruce.pares,
      soloSettlement: validacion.cruce.soloSettlement.length,
      soloRelease: validacion.cruce.soloRelease.length,
    })
  );
  console.log(
    validacion.ok
      ? '\nRESULTADO: el reporte de liberaciones sirve para validar. Activar MP_RELEASE_VALIDACION=true.'
      : '\nRESULTADO: no cierra. Revisar las columnas/tipos impresos antes de activar la validación.'
  );
}

main().catch((error) => {
  console.error('Spike falló:', error.message);
  process.exit(1);
});
