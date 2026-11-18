#!/usr/bin/env node

/**
 * Script de diagnóstico para sincronización wallet Mercado Pago (Argentina).
 *
 * Uso:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-... node apps/backend/scripts/test-mercadopago-sync.js
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-... node apps/backend/scripts/test-mercadopago-sync.js --full
 *
 * --full  Solicita reporte settlement, hace poll completo y descarga CSV (puede tardar 2+ min).
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoAdapter } from '../src/services/adapters/mercadoPagoAdapter.js';
import {
  MercadoPagoReportService,
  getSettlementPollConfig
} from '../src/services/mercadoPagoReportService.js';
import { mpAuthHeaders } from '../src/services/mercadoPagoUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FULL_MODE = process.argv.includes('--full');
const environment = process.env.NODE_ENV || 'production';
const envPath = path.resolve(__dirname, environment === 'production' ? '../.env.prod' : `../.env.${environment}`);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

async function testEndpoint(name, fn) {
  console.log(`\n--- ${name} ---`);
  try {
    const result = await fn();
    console.log('✅ OK', typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
    return { success: true, result };
  } catch (error) {
    console.log('❌ FAIL', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  const pollConfig = getSettlementPollConfig();
  console.log('=== DIAGNÓSTICO MERCADOPAGO WALLET AR ===');
  console.log('Ambiente:', environment);
  console.log('Modo:', FULL_MODE ? 'completo (poll + descarga)' : 'rápido (sin poll prolongado)');
  console.log('Token configurado:', !!ACCESS_TOKEN);
  console.log('Poll config:', pollConfig);

  if (!ACCESS_TOKEN) {
    console.error('\n❌ MERCADOPAGO_ACCESS_TOKEN no configurado');
    console.log('Obtené un token OAuth de usuario con: node apps/backend/scripts/test-mercadopago-oauth.js');
    process.exit(1);
  }

  const results = {};

  results.usersMe = await testEndpoint('/users/me', async () => {
    const res = await fetch('https://api.mercadopago.com/users/me', {
      headers: mpAuthHeaders(ACCESS_TOKEN)
    });
    if (!res.ok) throw new Error(`${res.status} - ${await res.text()}`);
    const data = await res.json();
    return { id: data.id, email: data.email, nickname: data.nickname, country: data.country_id };
  });

  const userId = results.usersMe.result?.id;
  if (!userId) {
    console.log('\n⚠️ No se pudo obtener userId, abortando pruebas dependientes');
    process.exit(1);
  }

  if (results.usersMe.result?.country && results.usersMe.result.country !== 'AR') {
    console.warn(`\n⚠️ Cuenta no es MLA (country=${results.usersMe.result.country}). Validación orientada a wallet AR.`);
  }

  const adapter = new MercadoPagoAdapter({ accessToken: ACCESS_TOKEN, userId });
  const fechaDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  results.paymentsCollector = await testEndpoint('/v1/payments/search (collector.id)', async () => {
    const pagos = await adapter.searchPayments({
      since: fechaDesde,
      limit: 5,
      filter: { collectorId: userId }
    });
    return { count: pagos.length, sample: pagos[0]?.id };
  });

  results.paymentsPayer = await testEndpoint('/v1/payments/search (payer.id)', async () => {
    const pagos = await adapter.searchPayments({
      since: fechaDesde,
      limit: 5,
      filter: { payerId: userId }
    });
    return { count: pagos.length, sample: pagos[0]?.id };
  });

  results.paymentsAll = await testEndpoint('/v1/payments/search (dual + P2P)', async () => {
    const pagos = await adapter.getAllPayments({ since: fechaDesde, limit: 50, maxPages: 4 });
    const transfers = pagos.filter((p) => p.operation_type === 'money_transfer');
    return {
      count: pagos.length,
      moneyTransfers: transfers.length,
      sampleTransfer: transfers[0]
        ? {
            id: transfers[0].id,
            amount: transfers[0].transaction_amount,
            payerId: transfers[0].payer?.id,
            collectorId: transfers[0].collector_id,
            status: transfers[0].status,
            description: transfers[0].description
          }
        : null
    };
  });

  results.moneyTransferOnly = await testEndpoint('/v1/payments/search operation_type=money_transfer', async () => {
    const { results: rows, total } = await adapter.searchPayments({
      since: fechaDesde,
      limit: 50,
      filter: { operationType: 'money_transfer' }
    });
    return {
      total,
      count: rows.length,
      sample: rows[0]
        ? { id: rows[0].id, amount: rows[0].transaction_amount, status: rows[0].status }
        : null
    };
  });

  results.balance = await testEndpoint('/users/{id}/mercadopago_account/balance', async () => {
    const res = await fetch(
      `https://api.mercadopago.com/users/${userId}/mercadopago_account/balance`,
      { headers: mpAuthHeaders(ACCESS_TOKEN) }
    );
    if (!res.ok) throw new Error(`${res.status} - ${await res.text()}`);
    return res.json();
  });

  results.accountMovements = await testEndpoint('account/movements (transferencias)', async () => {
    const movimientos = await adapter.getAccountMovements({
      since: fechaDesde,
      limit: 20,
      maxPages: 2
    });
    const sample = movimientos[0]
      ? {
          id: movimientos[0].id,
          amount: movimientos[0].amount,
          type: movimientos[0].type,
          detail: movimientos[0].detail || movimientos[0].description
        }
      : null;
    return { count: movimientos.length, sample };
  });

  results.settlementConfig = await testEndpoint('settlement_report/config', async () => {
    const service = new MercadoPagoReportService({ accessToken: ACCESS_TOKEN, userId });
    return service.configureReport();
  });

  results.settlementList = await testEndpoint('settlement_report/list', async () => {
    const service = new MercadoPagoReportService({ accessToken: ACCESS_TOKEN, userId });
    const reports = await service.listReports();
    return { total: reports.length, latest: reports[0]?.file_name };
  });

  const begin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date().toISOString();

  results.settlementCreate = await testEndpoint('settlement_report/create (últimos 7 días)', async () => {
    const service = new MercadoPagoReportService({ accessToken: ACCESS_TOKEN, userId });
    const created = await service.createReport(begin, end);
    const validStatus = [200, 202, 203].includes(created.status);
    if (!validStatus) {
      throw new Error(`Status inesperado: ${created.status}`);
    }
    return {
      httpStatus: created.status,
      expected: '202 Accepted (async) o 200/203',
      data: created.data
    };
  });

  if (FULL_MODE) {
    results.settlementPoll = await testEndpoint('settlement_report/poll + download', async () => {
      const service = new MercadoPagoReportService({ accessToken: ACCESS_TOKEN, userId });
      const report = await service.fetchSettlementMovements(begin, end);
      if (report.pending) {
        throw new Error('Reporte aún pendiente tras poll completo — MP puede tardar más; reintentar o importar CSV manual');
      }
      return {
        fileName: report.fileName,
        rows: report.total,
        sampleSourceId: report.rows?.[0]?.sourceId
      };
    });
  } else {
    console.log('\n--- settlement_report/poll + download ---');
    console.log('⏭️  Omitido (usar --full para validar poll y descarga CSV)');
    results.settlementPoll = { success: null, skipped: true };
  }

  console.log('\n=== RESUMEN ===');
  let failures = 0;
  for (const [key, val] of Object.entries(results)) {
    if (val.skipped) {
      console.log(`⏭️  ${key} (omitido)`);
    } else if (val.success) {
      console.log(`✅ ${key}`);
    } else {
      console.log(`❌ ${key}`);
      failures += 1;
    }
  }

  console.log('\n=== CRITERIOS DE VALIDACIÓN MLA ===');
  console.log('- settlement_report/create debe responder 202 (o 200/203)');
  console.log('- settlement_report/list debe ser accesible con token OAuth read');
  console.log('- Con --full: poll debe encontrar file_name y CSV parseable');
  console.log('- Si settlement falla: usar import CSV manual (no email parsing)');

  console.log('\n💡 Sync en Attadia: OAuth → sincronizar → si movimientos=0, importar CSV desde panel MP.');

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
