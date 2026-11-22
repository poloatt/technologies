/**
 * Reportes "Otras operaciones" de Mercado Pago — vía API unificada.
 * activities_withdraw: retiros y transferencias de fondos desde la cuenta
 * (incluye envíos / withdrawals que el settlement clásico no tipa como P2P).
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/reports/activities-reports/api
 */

import fetch from 'node-fetch';
import { mpAuthHeaders } from './mercadoPagoUtils.js';
import { parseSettlementCsv } from './mercadoPagoCsvParser.js';
import config from '../config/config.js';

const MP_BASE = 'https://api.mercadopago.com';
const REPORT_WITHDRAW = 'activities_withdraw';

function getPollConfig() {
  return {
    pollIntervalMs: parseInt(process.env.MP_ACTIVITIES_POLL_INTERVAL_MS || '2500', 10),
    maxPollAttempts: parseInt(process.env.MP_ACTIVITIES_MAX_POLL_ATTEMPTS || '24', 10)
  };
}

function webhookNotifier() {
  const base = (config.backendUrl || process.env.BACKEND_URL || 'https://api.attadia.com').replace(/\/$/, '');
  const key =
    process.env.MP_ACTIVITIES_WEBHOOK_KEY ||
    process.env.MERCADOPAGO_WEBHOOK_SECRET ||
    'attadia-mp-activities';
  return {
    type: 'webhook',
    data: {
      url: `${base}/api/webhooks/mercadopago-activities`,
      key
    }
  };
}

export function normalizeActivitiesWithdrawRow(row) {
  if (!row || typeof row !== 'object') return null;

  const operationId = String(
    row.OPERATION_ID || row.operation_id || row.SOURCE_ID || row.source_id || ''
  ).trim();
  if (!operationId) return null;

  const amountRaw = Number(
    row.NET_RECEIVED_AMOUNT ?? row.net_received_amount ?? row.TRANSACTION_AMOUNT ?? row.transaction_amount ?? 0
  );
  // Retiros/transferencias salientes: monto neto suele ser negativo o lo forzamos egreso
  const signedNet = amountRaw > 0 ? -Math.abs(amountRaw) : amountRaw || -Math.abs(Number(row.TRANSACTION_AMOUNT || 0));
  const counterpart = String(
    row.COUNTERPART_NAME || row.counterpart_name || row.COUNTERPART_EMAIL || ''
  ).trim();
  const opType = String(row.OPERATION_TYPE || row.operation_type || '').toLowerCase();
  const bankAccount = String(row.BANK_ACCOUNT || row.bank_account || '').trim();
  const status = String(row.STATUS || row.status || '').toLowerCase();

  // bank_account presente = CVU→CBU bancario; sin banco + contraparte = P2P CVU→CVU
  let transactionType = 'WITHDRAWAL';
  if (bankAccount) {
    transactionType = 'BANK_TRANSFER';
  } else if (opType.includes('transfer') || opType.includes('money_transfer') || opType.includes('p2p')) {
    transactionType = 'MONEY_TRANSFER';
  } else if (opType.includes('payout') || opType.includes('cash')) {
    transactionType = 'PAYOUT';
  } else if (counterpart) {
    transactionType = 'MONEY_TRANSFER';
  }

  const description =
    counterpart ||
    (bankAccount ? `Transferencia a CBU ${bankAccount}` : '') ||
    String(row.OPERATION_TYPE || row.operation_type || 'Transferencia').trim();

  const raw = {
    ...row,
    SOURCE_ID: operationId,
    TRANSACTION_TYPE: transactionType,
    DESCRIPTION: description,
    TRANSACTION_AMOUNT: Math.abs(Number(row.TRANSACTION_AMOUNT ?? row.transaction_amount ?? signedNet)),
    SETTLEMENT_NET_AMOUNT: signedNet,
    TRANSACTION_DATE: row.DATE_CREATED || row.date_created || row.DATE_APPROVED,
    EXTERNAL_REFERENCE: row.EXTERNAL_REFERENCE || row.external_reference || '',
    PAYMENT_METHOD: bankAccount ? 'bank_transfer' : 'account_money',
    PAYMENT_METHOD_TYPE: bankAccount ? 'bank_transfer' : 'account_money',
    METADATA: {
      counterpart_name: counterpart || null,
      bank_account: bankAccount || null,
      cbu: bankAccount || null,
      provider_id: row.PROVIDER_ID || row.provider_id || null,
      operation_type: row.OPERATION_TYPE || row.operation_type || null,
      status
    }
  };

  return {
    id: operationId,
    sourceId: operationId,
    transactionType,
    description,
    paymentMethod: raw.PAYMENT_METHOD,
    paymentMethodType: raw.PAYMENT_METHOD_TYPE,
    amount: Math.abs(raw.TRANSACTION_AMOUNT),
    netAmount: signedNet,
    feeAmount: 0,
    currency: 'ARS',
    date: raw.TRANSACTION_DATE,
    externalReference: raw.EXTERNAL_REFERENCE,
    raw,
    source: 'activities_withdraw',
    counterpartName: counterpart || null,
    status
  };
}

export class MercadoPagoActivitiesService {
  constructor({ accessToken, userId }) {
    this.accessToken = accessToken;
    this.userId = userId;
  }

  getWithdrawStructureColumns() {
    // bank_account / provider_id son clave para CVU→CBU (transferencia a banco)
    return [
      { key: 'date_created' },
      { key: 'operation_id' },
      { key: 'status' },
      { key: 'operation_type' },
      { key: 'transaction_amount' },
      { key: 'net_received_amount' },
      { key: 'counterpart_name' },
      { key: 'bank_account' },
      { key: 'provider_id' }
    ];
  }

  withdrawConfigHasBankAccount(existing) {
    const cols = existing?.structure?.columns || existing?.columns || [];
    return cols.some((c) => String(c.key || c).toLowerCase() === 'bank_account');
  }

  async ensureWithdrawConfig() {
    const columns = this.getWithdrawStructureColumns();
    const structureBase = {
      name: `attadia-withdraw-${this.userId}`,
      columns,
      file_format: {
        separator: ';',
        prefix: `attadia-withdraw-${this.userId}`
      },
      display_timezone: 'GMT-03'
    };

    const getRes = await fetch(
      `${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/config`,
      { headers: mpAuthHeaders(this.accessToken) }
    );

    if (getRes.ok) {
      const existing = await getRes.json();
      const structureId = existing?.structure?.id || existing?.id;
      if (structureId) {
        if (!this.withdrawConfigHasBankAccount(existing)) {
          console.log(
            '[MP Activities] Config withdraw sin bank_account — actualizando para CBU bancarios...'
          );
          const putRes = await fetch(
            `${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/config/${encodeURIComponent(structureId)}`,
            {
              method: 'PUT',
              headers: mpAuthHeaders(this.accessToken),
              body: JSON.stringify({
                structure: { ...structureBase, id: structureId },
                notifiers: existing.notifiers || [{ type: 'internal_sftp', data: {} }]
              })
            }
          );
          if (putRes.ok) {
            console.log('[MP Activities] Config withdraw actualizada con bank_account');
            try {
              return await putRes.json();
            } catch {
              return existing;
            }
          }
          const putText = await putRes.text();
          console.warn(
            '[MP Activities] No se pudo actualizar config withdraw:',
            putRes.status,
            putText.slice(0, 300)
          );
        } else {
          console.log('[MP Activities] Config withdraw existente:', structureId);
        }
        return existing;
      }
    }

    const body = {
      structure: structureBase,
      notifiers: [webhookNotifier()]
    };

    // Preferir internal_sftp si MP lo acepta (sin infra extra)
    const attempts = [
      { ...body, notifiers: [{ type: 'internal_sftp', data: {} }] },
      body
    ];

    for (const payload of attempts) {
      const res = await fetch(`${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/config`, {
        method: 'POST',
        headers: mpAuthHeaders(this.accessToken),
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      if (res.ok || res.status === 201) {
        console.log('[MP Activities] Config withdraw creada');
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      }
      if (res.status === 409 || text.toLowerCase().includes('already')) {
        console.log('[MP Activities] Config withdraw ya existe');
        return null;
      }
      console.warn('[MP Activities] Config attempt failed:', res.status, text.slice(0, 300));
    }

    return null;
  }

  async createWithdrawStatement(beginDate, endDate) {
    // Docs oficiales: solo filters (sin file_format). Si falla, settlement WITHDRAWAL es el fallback.
    const bodies = [
      {
        filters: {
          creation_date: {
            range: { gte: beginDate, lte: endDate }
          }
        }
      },
      {
        filters: {
          creation_date: {
            range: { gte: beginDate, lte: endDate }
          }
        },
        file_format: 'csv'
      }
    ];

    let lastError = null;
    for (const body of bodies) {
      const res = await fetch(
        `${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/statements`,
        {
          method: 'POST',
          headers: mpAuthHeaders(this.accessToken),
          body: JSON.stringify(body)
        }
      );
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (res.ok) {
        const recordId = data.record_id || data.uid || data.id;
        if (!recordId) {
          throw new Error(`activities_withdraw sin record_id: ${text}`);
        }
        return { recordId, data };
      }

      lastError = new Error(`activities_withdraw create: ${res.status} - ${text}`);
      lastError.status = res.status;
      lastError.data = data;
      // Si no es formato, no tiene sentido reintentar el otro body
      if (!String(text).includes('UNSUPPORTED_OUTPUT_FORMAT')) break;
    }

    throw lastError || new Error('activities_withdraw create falló');
  }

  async getStatement(uid) {
    const res = await fetch(
      `${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/statements/${encodeURIComponent(uid)}`,
      { headers: mpAuthHeaders(this.accessToken) }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`activities_withdraw status: ${res.status} - ${text}`);
    }
    return res.json();
  }

  async listStatements({ limit = 20 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    const res = await fetch(
      `${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/statements?${params}`,
      { headers: mpAuthHeaders(this.accessToken) }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`activities_withdraw list: ${res.status} - ${text}`);
    }
    const data = await res.json();
    return data.results || data.records || (Array.isArray(data) ? data : []);
  }

  async downloadStatement(uid) {
    const res = await fetch(
      `${MP_BASE}/v1/reporting/operations/${REPORT_WITHDRAW}/statements/${encodeURIComponent(uid)}/download`,
      { headers: { Authorization: `Bearer ${this.accessToken}`, 'User-Agent': 'Attadia/1.0' } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`activities_withdraw download: ${res.status} - ${text}`);
    }
    return res.text();
  }

  async waitForStatement(uid, pollOptions = {}) {
    const { pollIntervalMs, maxPollAttempts } = { ...getPollConfig(), ...pollOptions };
    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      const statusDoc = await this.getStatement(uid);
      const status = String(statusDoc.status || statusDoc.state || '').toLowerCase();
      if (status === 'available' || status === 'ready' || status === 'processed') {
        return statusDoc;
      }
      if (status === 'failed') {
        throw new Error(`activities_withdraw failed: ${JSON.stringify(statusDoc)}`);
      }
      if (status === 'empty') {
        return { ...statusDoc, empty: true };
      }
    }
    const err = new Error('Timeout esperando activities_withdraw');
    err.pending = true;
    err.uid = uid;
    throw err;
  }

  /**
   * Flujo completo: config → create → poll → download → normalize rows.
   * Ante fallo, intenta reutilizar el último statement available.
   */
  async fetchWithdrawMovements(beginDate, endDate, options = {}) {
    try {
      await this.ensureWithdrawConfig();
    } catch (error) {
      console.warn('[MP Activities] ensure config:', error.message);
    }

    let recordId = null;
    try {
      const created = await this.createWithdrawStatement(beginDate, endDate);
      recordId = created.recordId;
    } catch (error) {
      console.warn('[MP Activities] create statement:', error.message);
      // Reutilizar último available
      try {
        const listed = await this.listStatements({ limit: 10 });
        const available = listed.find((s) =>
          ['available', 'ready', 'processed'].includes(String(s.status || '').toLowerCase())
        );
        if (available) {
          recordId = available.record_id || available.uid || available.id;
          console.log('[MP Activities] Reutilizando statement', recordId);
        } else {
          throw error;
        }
      } catch (listErr) {
        throw error;
      }
    }

    if (!recordId) {
      return { rows: [], total: 0, error: 'Sin record_id' };
    }

    try {
      const ready = await this.waitForStatement(recordId, options.pollOptions);
      if (ready.empty) {
        return { rows: [], total: 0, empty: true, recordId };
      }
      const csvText = await this.downloadStatement(recordId);
      const parsed = parseSettlementCsv(csvText);
      // parseSettlementCsv normaliza columnas settlement; re-mapear desde raw
      const rows = [];
      for (const row of parsed) {
        const raw = row.raw || row;
        const normalized = normalizeActivitiesWithdrawRow(raw);
        if (normalized) rows.push(normalized);
      }
      // Si el parser no encontró OPERATION_ID (headers distintos), parse manual de raw keys
      if (!rows.length && csvText) {
        const fallback = parseSettlementCsv(csvText);
        for (const row of fallback) {
          const n = normalizeActivitiesWithdrawRow({
            ...(row.raw || {}),
            OPERATION_ID: row.sourceId || row.id,
            TRANSACTION_AMOUNT: row.amount,
            NET_RECEIVED_AMOUNT: row.netAmount,
            DATE_CREATED: row.date,
            OPERATION_TYPE: row.transactionType,
            COUNTERPART_NAME: row.description
          });
          if (n) rows.push(n);
        }
      }

      console.log(`[MP Activities] withdraw rows: ${rows.length}`);
      return { rows, total: rows.length, recordId, source: 'activities_withdraw' };
    } catch (error) {
      if (error.pending) {
        return {
          rows: [],
          total: 0,
          pending: true,
          recordId,
          error: error.message
        };
      }
      throw error;
    }
  }
}
