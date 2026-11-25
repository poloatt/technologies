#!/usr/bin/env node

/**
 * Muestra cómo llegan por la API los pagos que Mercado Pago hace con dinero de la reserva
 * (servicios integrados: Edesur, Metrogas, etc.).
 *
 * Uso:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-... node apps/backend/scripts/inspect-mp-reserva-pagos.js [dias]
 *
 * Imprime un resumen y guarda el JSON completo en scripts/mp-reserva-pagos.json.
 * No sube ni modifica nada en la base de datos.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mpAuthHeaders } from '../src/services/mercadoPagoUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const DIAS = Number(process.argv[2]) || 90;
const OUT = path.resolve(__dirname, 'mp-reserva-pagos.json');

if (!ACCESS_TOKEN) {
  console.error('Falta MERCADOPAGO_ACCESS_TOKEN');
  process.exit(1);
}

async function buscarPagosDelUsuario() {
  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
  const hasta = new Date().toISOString();
  const resultados = [];

  for (let offset = 0; offset < 1000; offset += 50) {
    const qs = new URLSearchParams({
      sort: 'date_created',
      criteria: 'desc',
      limit: '50',
      offset: String(offset),
      range: 'date_created',
      begin_date: desde,
      end_date: hasta,
      payer: 'me',
    });
    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${qs}`, {
      headers: mpAuthHeaders(ACCESS_TOKEN),
    });
    if (!res.ok) {
      console.warn(`search status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      break;
    }
    const data = await res.json();
    const page = data.results || [];
    resultados.push(...page);
    if (!page.length || resultados.length >= (data.paging?.total ?? 0)) break;
  }
  return resultados;
}

function esCandidato(pago) {
  const tipo = String(pago.payment_type_id || pago.payment_method?.type || '').toLowerCase();
  const op = String(pago.operation_type || '').toLowerCase();
  return tipo === 'account_money' || op === 'regular_payment' || op === 'partition_transfer';
}

function resumen(pago) {
  const poi = pago.point_of_interaction || {};
  const bi = poi.business_info || {};
  return {
    id: pago.id,
    fecha: pago.date_created,
    estado: pago.status,
    operacion: pago.operation_type,
    medioTipo: pago.payment_type_id,
    medioId: pago.payment_method_id,
    collector: pago.collector_id,
    payer: pago.payer?.id,
    monto: pago.transaction_amount,
    descripcion: pago.description || pago.statement_descriptor || null,
    poi_type: poi.type,
    poi_sub_type: poi.sub_type,
    branch: bi.branch,
    sub_unit: bi.sub_unit,
    unit: bi.unit,
    metadataKeys: Object.keys(pago.metadata || {}),
  };
}

async function main() {
  const pagos = await buscarPagosDelUsuario();
  const candidatos = pagos.filter(esCandidato);

  console.log(`Pagos del usuario en ${DIAS} días: ${pagos.length}`);
  console.log(`Candidatos (cuenta de dinero, regular_payment o partition_transfer): ${candidatos.length}`);
  console.log('');

  for (const pago of candidatos) {
    console.log(JSON.stringify(resumen(pago)));
  }

  fs.writeFileSync(OUT, JSON.stringify(candidatos, null, 2), 'utf8');
  console.log('');
  console.log(`JSON completo guardado en: ${OUT}`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
