#!/usr/bin/env node

/**
 * Prueba de verdad P2P / "enviar dinero" (Mercado Pago wallet AR).
 *
 * Uso (después de hacer un envío real en la app MP):
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-... node apps/backend/scripts/test-mercadopago-p2p.js
 *   MERCADOPAGO_ACCESS_TOKEN=... node apps/backend/scripts/test-mercadopago-p2p.js --reuse-settlement
 *
 * --reuse-settlement  Descarga reportes ya existentes (no crea; evita 429 de cupo).
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoAdapter } from '../src/services/adapters/mercadoPagoAdapter.js';
import { MercadoPagoReportService } from '../src/services/mercadoPagoReportService.js';
import {
  clasificarMovimientoEconomicoMp,
  mpAuthHeaders
} from '../src/services/mercadoPagoUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REUSE = process.argv.includes('--reuse-settlement');
const environment = process.env.NODE_ENV || 'production';
dotenv.config({
  path: path.resolve(__dirname, environment === 'production' ? '../.env.prod' : `../.env.${environment}`)
});
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

function histogram(items, keyFn) {
  const map = {};
  for (const item of items) {
    const key = keyFn(item) || '(vacío)';
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

async function main() {
  console.log('=== PRUEBA DE VERDAD P2P MERCADOPAGO ===');
  if (!ACCESS_TOKEN) {
    console.error('Falta MERCADOPAGO_ACCESS_TOKEN');
    process.exit(1);
  }

  const meRes = await fetch('https://api.mercadopago.com/users/me', {
    headers: mpAuthHeaders(ACCESS_TOKEN)
  });
  if (!meRes.ok) throw new Error(`users/me ${meRes.status}`);
  const me = await meRes.json();
  const userId = me.id;
  console.log('Usuario:', { id: userId, nickname: me.nickname, email: me.email });

  const adapter = new MercadoPagoAdapter({ accessToken: ACCESS_TOKEN, userId });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const pagos = await adapter.getAllPayments({ since, limit: 50, maxPages: 6 });
  const transfers = pagos.filter((p) => String(p.operation_type || '').toLowerCase() === 'money_transfer');
  const accountMoney = pagos.filter(
    (p) => String(p.payment_type_id || p.payment_method?.type || '').toLowerCase() === 'account_money'
  );

  console.log('\n--- payments/search ---');
  console.log('Total pagos:', pagos.length);
  console.log('money_transfer:', transfers.length);
  console.log('account_money:', accountMoney.length);
  console.log('operation_types:', histogram(pagos, (p) => p.operation_type));
  console.log('payment_type_ids:', histogram(pagos, (p) => p.payment_type_id || p.payment_method?.type));
  if (transfers[0]) {
    console.log('Sample money_transfer:', {
      id: transfers[0].id,
      amount: transfers[0].transaction_amount,
      status: transfers[0].status,
      payerId: transfers[0].payer?.id,
      collectorId: transfers[0].collector_id,
      description: transfers[0].description,
      date: transfers[0].date_created
    });
  }

  const { results: mtOnly, total: mtTotal } = await adapter.searchPayments({
    since,
    limit: 50,
    filter: { operationType: 'money_transfer' }
  });
  console.log('\n--- money_transfer only ---', { total: mtTotal, count: mtOnly.length });

  let movements = [];
  try {
    movements = await adapter.getAccountMovements({ since, limit: 50, maxPages: 4 });
  } catch (e) {
    console.warn('account/movements FAIL:', e.message);
  }
  console.log('\n--- account/movements ---', { count: movements.length });
  if (movements[0]) {
    console.log('Sample movement keys:', Object.keys(movements[0]));
    console.log('Sample:', {
      id: movements[0].id,
      amount: movements[0].amount,
      type: movements[0].type,
      detail: movements[0].detail || movements[0].description || movements[0].concept
    });
  }

  const reportService = new MercadoPagoReportService({ accessToken: ACCESS_TOKEN, userId });
  let settlementRows = [];
  if (REUSE) {
    const reused = await reportService.reuseExistingReports(since, new Date().toISOString());
    settlementRows = reused?.rows || [];
    console.log('\n--- settlement reuse ---', {
      files: reused?.fileNames,
      rows: settlementRows.length
    });
  } else {
    console.log('\n--- settlement --- (omitido create; usar --reuse-settlement para CSV existente)');
  }

  const kinds = histogram(settlementRows, (r) =>
    clasificarMovimientoEconomicoMp({
      transactionType: r.transactionType,
      description: r.description,
      netAmount: r.netAmount,
      raw: r.raw
    }).movementKind
  );
  const txTypes = histogram(settlementRows, (r) => r.transactionType);
  console.log('Settlement TRANSACTION_TYPE:', txTypes);
  console.log('Settlement movementKinds:', kinds);

  const p2pFromSettlement = settlementRows.filter((r) => {
    const k = clasificarMovimientoEconomicoMp({
      transactionType: r.transactionType,
      description: r.description,
      netAmount: r.netAmount,
      raw: r.raw
    }).movementKind;
    return k === 'P2P_TRANSFER' || k === 'EXTERNAL_TRANSFER';
  });
  console.log('Settlement filas tipadas transferencia:', p2pFromSettlement.length);

  console.log('\n=== VEREDICTO P2P ===');
  if (transfers.length > 0 || mtOnly.length > 0) {
    console.log('✅ payments/search SÍ expone money_transfer → Caja puede ingestar P2P.');
    console.log('   Siguiente: sync producción y verificar metadata.movementKind=P2P_TRANSFER.');
  } else if (p2pFromSettlement.length > 0) {
    console.log('⚠️ money_transfer vacío, pero settlement/heurística ve transferencias.');
    console.log('   Siguiente: mapear DESCRIPTION/TRANSACTION_TYPE de esas filas en el clasificador.');
  } else if (movements.length > 0) {
    console.log('⚠️ Solo account/movements tiene datos. Revisar sample detail para heurísticas.');
  } else {
    console.log('❌ Ninguna fuente devolvió P2P/enviar dinero.');
    console.log('   Conclusión probable: limitación de API OAuth personal (no hay ledger P2P público).');
    console.log('   Mitigación: reconciliación saldo MP vs ledger + CSV + SFA futuro.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
