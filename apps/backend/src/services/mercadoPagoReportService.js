import fetch from 'node-fetch';
import { mpAuthHeaders } from './mercadoPagoUtils.js';
import { parseSettlementCsv } from './mercadoPagoCsvParser.js';

const MP_BASE = 'https://api.mercadopago.com';

export function getSettlementPollConfig() {
  return {
    pollIntervalMs: parseInt(process.env.MP_SETTLEMENT_POLL_INTERVAL_MS || '3000', 10),
    maxPollAttempts: parseInt(process.env.MP_SETTLEMENT_MAX_POLL_ATTEMPTS || '40', 10),
    pendingMaxAgeMs: parseInt(
      process.env.MP_SETTLEMENT_PENDING_MAX_AGE_MS || String(24 * 60 * 60 * 1000),
      10
    )
  };
}

function dateWithinTolerance(reportDate, targetDate, toleranceDays = 1) {
  if (!reportDate || !targetDate) return false;
  const report = new Date(String(reportDate).slice(0, 10));
  const target = new Date(String(targetDate).slice(0, 10));
  const diffDays = Math.abs(report - target) / (24 * 60 * 60 * 1000);
  return diffDays <= toleranceDays;
}

export function splitDateRangeIntoMonthlyChunks(beginDate, endDate) {
  const chunks = [];
  let start = new Date(beginDate);
  const end = new Date(endDate);

  while (start < end) {
    const chunkEnd = new Date(start);
    chunkEnd.setMonth(chunkEnd.getMonth() + 1);
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }
    chunks.push({
      beginDate: start.toISOString(),
      endDate: chunkEnd.toISOString()
    });
    start = new Date(chunkEnd.getTime() + 1);
  }

  return chunks;
}

function reportFileName(report) {
  return report?.file_name || report?.filename || report?.fileName || null;
}

function isReportReady(report) {
  const status = String(report?.status || '').toLowerCase();
  return Boolean(reportFileName(report)) && (!status || status === 'processed' || status === 'ready');
}

function findStrictReportMatch(reports, beginDate, endDate) {
  return reports.find((r) => {
    if (!isReportReady(r)) return false;
    const beginOk =
      r.begin_date?.startsWith(beginDate.slice(0, 10)) ||
      dateWithinTolerance(r.begin_date, beginDate);
    const endOk =
      r.end_date?.startsWith(endDate.slice(0, 10)) ||
      dateWithinTolerance(r.end_date, endDate);
    return beginOk && endOk;
  });
}

/** Reportes procesados que se solapan con el rango pedido (para reutilizar ante cupo 429). */
function findOverlappingReports(reports, beginDate, endDate) {
  const start = new Date(String(beginDate).slice(0, 10));
  const end = new Date(String(endDate).slice(0, 10));
  return (reports || [])
    .filter((r) => isReportReady(r) && r.begin_date && r.end_date)
    .filter((r) => {
      const rStart = new Date(String(r.begin_date).slice(0, 10));
      const rEnd = new Date(String(r.end_date).slice(0, 10));
      return rStart <= end && rEnd >= start;
    })
    .sort((a, b) => new Date(b.generation_date || b.last_modified || 0) - new Date(a.generation_date || a.last_modified || 0));
}

export class SettlementReportQuotaError extends Error {
  constructor(message, { beginDate, endDate } = {}) {
    super(message);
    this.name = 'SettlementReportQuotaError';
    this.beginDate = beginDate;
    this.endDate = endDate;
    this.status = 429;
  }
}

function isQuotaExceededError(error) {
  const msg = String(error?.message || error || '');
  return (
    msg.includes('Max number of reports achieved') ||
    msg.includes('"status":429') ||
    /\b429\b/.test(msg)
  );
}

export class SettlementReportTimeoutError extends Error {
  constructor(message, { beginDate, endDate } = {}) {
    super(message);
    this.name = 'SettlementReportTimeoutError';
    this.beginDate = beginDate;
    this.endDate = endDate;
  }
}

export class MercadoPagoReportService {
  constructor({ accessToken, userId }) {
    this.accessToken = accessToken;
    this.userId = userId;
  }

  getSettlementConfigBody() {
    // Columnas oficiales del glosario Account Money. include_withdraw es crítico
    // para traer transferencias bancarias (WITHDRAWAL / WITHDRAWAL_CANCEL / PAYOUT).
    return {
      file_name_prefix: `attadia-settlement-${this.userId}`,
      show_fee_prevision: false,
      show_chargeback_cancel: true,
      include_withdraw: true,
      coupon_detailed: true,
      shipping_detail: true,
      refund_detailed: true,
      header_language: 'es',
      separator: ';',
      columns: [
        { key: 'TRANSACTION_DATE' },
        { key: 'SOURCE_ID' },
        { key: 'EXTERNAL_REFERENCE' },
        { key: 'TRANSACTION_TYPE' },
        // DESCRIPTION ayuda a detectar reservas / rendimientos / transferencias P2P
        { key: 'DESCRIPTION' },
        { key: 'TRANSACTION_AMOUNT' },
        { key: 'TRANSACTION_CURRENCY' },
        { key: 'FEE_AMOUNT' },
        { key: 'SETTLEMENT_NET_AMOUNT' },
        { key: 'SETTLEMENT_DATE' },
        { key: 'REAL_AMOUNT' },
        { key: 'PAYMENT_METHOD' },
        { key: 'PAYMENT_METHOD_TYPE' },
        { key: 'METADATA' },
        { key: 'USER_ID' }
      ]
    };
  }

  async updateReportConfig() {
    const body = this.getSettlementConfigBody();
    const response = await fetch(`${MP_BASE}/v1/account/settlement_report/config`, {
      method: 'PUT',
      headers: mpAuthHeaders(this.accessToken),
      body: JSON.stringify(body)
    });

    if (response.status === 200 || response.status === 201) {
      console.log('[MP Report] Config actualizada con include_withdraw=true');
      return response.json();
    }

    const errorText = await response.text();
    console.warn('[MP Report] Error actualizando config:', response.status, errorText);
    return null;
  }

  async configureReport() {
    const body = this.getSettlementConfigBody();

    const response = await fetch(`${MP_BASE}/v1/account/settlement_report/config`, {
      method: 'POST',
      headers: mpAuthHeaders(this.accessToken),
      body: JSON.stringify(body)
    });

    if (response.status === 200 || response.status === 201) {
      return response.json();
    }

    const errorText = await response.text();
    if (response.status === 409 || errorText.toLowerCase().includes('already')) {
      // Config previa pudo haberse creado sin include_withdraw; forzar PUT.
      console.log('[MP Report] Config ya existe — actualizando para incluir transferencias/retiros...');
      return this.updateReportConfig();
    }

    console.warn('[MP Report] Error configurando reporte:', response.status, errorText);
    return null;
  }

  async createReport(beginDate, endDate) {
    const response = await fetch(`${MP_BASE}/v1/account/settlement_report`, {
      method: 'POST',
      headers: mpAuthHeaders(this.accessToken),
      body: JSON.stringify({
        begin_date: beginDate,
        end_date: endDate
      })
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (response.status === 429 || String(data?.message || '').includes('Max number of reports')) {
      throw new SettlementReportQuotaError(
        `Error creando reporte settlement: ${response.status} - ${text}`,
        { beginDate, endDate }
      );
    }

    if (response.status !== 202 && response.status !== 200 && response.status !== 203) {
      throw new Error(`Error creando reporte settlement: ${response.status} - ${text}`);
    }

    return { status: response.status, data };
  }

  async listReports() {
    const response = await fetch(`${MP_BASE}/v1/account/settlement_report/list`, {
      headers: mpAuthHeaders(this.accessToken)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error listando reportes: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  }

  async downloadReport(fileName) {
    const encoded = encodeURIComponent(fileName);
    const response = await fetch(`${MP_BASE}/v1/account/settlement_report/${encoded}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'User-Agent': 'Attadia/1.0' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error descargando reporte: ${response.status} - ${errorText}`);
    }

    return response.text();
  }

  async waitForReportFile(beginDate, endDate, options = {}) {
    const { pollIntervalMs, maxPollAttempts } = { ...getSettlementPollConfig(), ...options };

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      const reports = await this.listReports();
      const match = findStrictReportMatch(reports, beginDate, endDate);
      const fileName = reportFileName(match);

      if (fileName) {
        return fileName;
      }
    }

    throw new SettlementReportTimeoutError(
      'Timeout esperando generación del reporte settlement',
      { beginDate, endDate }
    );
  }

  async completeReport(beginDate, endDate, pollOptions = {}) {
    const fileName = await this.waitForReportFile(beginDate, endDate, pollOptions);
    const csvText = await this.downloadReport(fileName);
    const rows = parseSettlementCsv(csvText);
    return { rows, fileName, total: rows.length };
  }

  /**
   * Descarga y mergea reportes ya existentes que cubran el rango (sin crear uno nuevo).
   */
  async reuseExistingReports(beginDate, endDate) {
    const reports = await this.listReports();
    const strict = findStrictReportMatch(reports, beginDate, endDate);
    const candidates = strict ? [strict] : findOverlappingReports(reports, beginDate, endDate);

    if (!candidates.length) {
      return null;
    }

    const byId = new Map();
    const fileNames = [];
    for (const report of candidates) {
      const fileName = reportFileName(report);
      if (!fileName || fileNames.includes(fileName)) continue;
      try {
        const csvText = await this.downloadReport(fileName);
        const rows = parseSettlementCsv(csvText);
        fileNames.push(fileName);
        for (const row of rows) {
          const key = String(row.sourceId || row.id || '');
          if (key && !byId.has(key)) byId.set(key, row);
        }
      } catch (error) {
        console.warn(`[MP Report] No se pudo reutilizar ${fileName}:`, error.message);
      }
    }

    if (!fileNames.length) return null;

    console.log('[MP Report] Reutilizando reportes existentes:', {
      beginDate,
      endDate,
      files: fileNames,
      rows: byId.size
    });

    return {
      rows: Array.from(byId.values()),
      fileName: fileNames[0],
      fileNames,
      total: byId.size,
      reused: true
    };
  }

  async requestReport(beginDate, endDate) {
    await this.configureReport();
    return this.createReport(beginDate, endDate);
  }

  async tryCompletePendingReport(pending, pollOptions = {}) {
    if (!pending?.beginDate || !pending?.endDate) {
      return null;
    }

    const { pendingMaxAgeMs } = getSettlementPollConfig();
    if (pending.solicitadoEn) {
      const age = Date.now() - new Date(pending.solicitadoEn).getTime();
      if (age > pendingMaxAgeMs) {
        return { expired: true, pending };
      }
    }

    try {
      const result = await this.completeReport(pending.beginDate, pending.endDate, pollOptions);
      return { ...result, completed: true };
    } catch (error) {
      if (error instanceof SettlementReportTimeoutError) {
        return { completed: false, pending, error: error.message };
      }
      throw error;
    }
  }

  async fetchSettlementMovements(beginDate, endDate, options = {}) {
    const pollOptions = options.pollOptions || {};

    if (options.pending) {
      const pendingResult = await this.tryCompletePendingReport(options.pending, pollOptions);
      if (pendingResult?.completed) {
        return {
          rows: pendingResult.rows,
          fileName: pendingResult.fileName,
          total: pendingResult.total,
          fromPending: true
        };
      }
      if (pendingResult?.expired) {
        console.log('[MP Report] Reporte pendiente expirado, solicitando uno nuevo...');
      } else if (pendingResult && !pendingResult.completed) {
        // Ante pendiente, intentar reutilizar lo que ya exista en el cupo
        const reusedPending = await this.reuseExistingReports(beginDate, endDate);
        if (reusedPending?.rows?.length) {
          return { ...reusedPending, partial: true };
        }
        return {
          rows: [],
          pending: true,
          beginDate: options.pending.beginDate,
          endDate: options.pending.endDate
        };
      }
    }

    // 1) Reutilizar reportes ya generados (evita 429 por cupo)
    let reusedFallback = null;
    try {
      const reports = await this.listReports();
      const strict = findStrictReportMatch(reports, beginDate, endDate);
      if (strict) {
        const reused = await this.reuseExistingReports(beginDate, endDate);
        if (reused?.rows) return reused;
      }
      reusedFallback = await this.reuseExistingReports(beginDate, endDate);
    } catch (error) {
      console.warn('[MP Report] Reuso previo falló:', error.message);
    }

    try {
      await this.requestReport(beginDate, endDate);
    } catch (error) {
      if (error instanceof SettlementReportQuotaError || isQuotaExceededError(error)) {
        console.warn('[MP Report] Cupo de reportes agotado (429). Reutilizando existentes...');
        const reused =
          reusedFallback || (await this.reuseExistingReports(beginDate, endDate));
        if (reused?.rows?.length) {
          return {
            ...reused,
            partial: true,
            quotaExceeded: true
          };
        }
        // Sin CSV reutilizable: seguir con payments/account movements
        return {
          rows: [],
          pending: false,
          quotaExceeded: true,
          beginDate,
          endDate,
          error: error.message
        };
      }
      throw error;
    }

    try {
      const result = await this.completeReport(beginDate, endDate, pollOptions);
      return result;
    } catch (error) {
      if (error instanceof SettlementReportTimeoutError) {
        const reused =
          reusedFallback || (await this.reuseExistingReports(beginDate, endDate));
        if (reused?.rows?.length) {
          return { ...reused, partial: true };
        }
        return {
          rows: [],
          pending: true,
          beginDate,
          endDate
        };
      }
      throw error;
    }
  }

  /**
   * Solicita reportes en chunks mensuales y deduplica filas por SOURCE_ID.
   * Ante cupo 429 reutiliza reportes existentes y no sigue creando.
   */
  async fetchAllSettlementMovements(beginDate, endDate, options = {}) {
    const chunks = splitDateRangeIntoMonthlyChunks(beginDate, endDate);
    const byId = new Map();
    let pendingInfo = null;
    let pendingConsumed = false;
    let quotaExceeded = false;

    for (const chunk of chunks) {
      const chunkOptions = {
        ...options,
        pending: !pendingConsumed ? options.pending : undefined
      };

      const result = await this.fetchSettlementMovements(
        chunk.beginDate,
        chunk.endDate,
        chunkOptions
      );

      if (options.pending && !pendingConsumed) {
        pendingConsumed = true;
      }

      for (const row of result.rows || []) {
        const key = String(row.sourceId || row.id || '');
        if (key && !byId.has(key)) {
          byId.set(key, row);
        }
      }

      if (result.quotaExceeded) {
        quotaExceeded = true;
        // No intentar más creates; mergear overlap del resto del rango una sola vez
        const rest = await this.reuseExistingReports(chunk.beginDate, endDate);
        for (const row of rest?.rows || []) {
          const key = String(row.sourceId || row.id || '');
          if (key && !byId.has(key)) byId.set(key, row);
        }
        break;
      }

      if (result.pending) {
        pendingInfo = {
          pending: true,
          beginDate: result.beginDate || chunk.beginDate,
          endDate,
          chunksProcessed: chunks.indexOf(chunk)
        };
        break;
      }
    }

    const rows = Array.from(byId.values());
    if (pendingInfo) {
      return {
        rows,
        total: rows.length,
        pending: true,
        beginDate: pendingInfo.beginDate,
        endDate: pendingInfo.endDate,
        partial: rows.length > 0
      };
    }

    if (quotaExceeded) {
      return {
        rows,
        total: rows.length,
        partial: true,
        quotaExceeded: true,
        beginDate,
        endDate
      };
    }

    return { rows, total: rows.length };
  }

  parseCsvContent(csvText) {
    return parseSettlementCsv(csvText);
  }
}
