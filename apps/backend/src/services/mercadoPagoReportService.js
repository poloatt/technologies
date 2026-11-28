import fetch from 'node-fetch';
import { mpAuthHeaders } from './mercadoPagoUtils.js';
import { parseSettlementCsv } from './mercadoPagoCsvParser.js';
import {
  esReporteConfiable,
  fusionarCobertura,
  coberturaCubre,
  ventanaValidada,
  esTipoRetiro
} from './mercadoPagoRetiros.js';

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

function reportMatchesRange(report, beginDate, endDate) {
  const beginOk =
    report.begin_date?.startsWith(beginDate.slice(0, 10)) ||
    dateWithinTolerance(report.begin_date, beginDate);
  const endOk =
    report.end_date?.startsWith(endDate.slice(0, 10)) ||
    dateWithinTolerance(report.end_date, endDate);
  return beginOk && endOk;
}

function reportGeneratedAt(report) {
  return new Date(report?.generation_date || report?.last_modified || 0).getTime() || 0;
}

/** Subconjunto del metadato de MP que necesitan la sync y los tests. */
export function reportMeta(report) {
  if (!report) return null;
  return {
    id: report.id != null ? String(report.id) : null,
    file_name: reportFileName(report),
    created_from: report.created_from || null,
    begin_date: report.begin_date || null,
    end_date: report.end_date || null,
    date_created: report.date_created || report.generation_date || report.last_modified || null
  };
}

const REUSE_BEGIN_TOLERANCE_MS = 24 * 60 * 60 * 1000;
const MAX_REUSE_REPORTS = 40;

/**
 * Ventanas que un conjunto de reportes valida (solo los de confianza), ya fusionadas.
 * Cada ventana llega hasta cuando se generó el reporte, nunca más allá de su fin.
 */
export function ventanasDeConfianza(reports = [], { trustedSince, trustedIds, now = Date.now() } = {}) {
  const opciones = { ...(trustedSince ? { trustedSince } : {}), ...(trustedIds ? { trustedIds } : {}) };
  const tramos = [];
  for (const report of reports || []) {
    if (!esReporteConfiable(report, opciones)) continue;
    const ventana = ventanaValidada(report, { now });
    if (ventana) tramos.push({ ...ventana, reportId: report.id != null ? String(report.id) : null, fuente: 'settlement' });
  }
  return fusionarCobertura(tramos);
}

/** Preferir el reporte más reciente del rango (include_withdraw cambia el contenido). */
function findStrictReportMatch(reports, beginDate, endDate, { afterMs = 0, reportId = null } = {}) {
  const list = reports || [];

  if (reportId != null) {
    const byId = list.find((r) => isReportReady(r) && String(r.id) === String(reportId));
    if (byId) return byId;
  }

  const candidates = list
    .filter((r) => isReportReady(r) && reportMatchesRange(r, beginDate, endDate))
    .filter((r) => (afterMs > 0 ? reportGeneratedAt(r) >= afterMs - 5000 : true))
    .sort((a, b) => reportGeneratedAt(b) - reportGeneratedAt(a));

  return candidates[0] || null;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const SETTLEMENT_REUSE_MAX_AGE_MS_DEFAULT = 6 * 60 * 60 * 1000;

/**
 * Antigüedad máxima de un reporte para reutilizarlo sin pedir uno nuevo.
 * La sync rápida mueve la ventana en cada corrida, así que sin esto cada sync
 * (manual o cron) consume cupo diario de MP.
 */
export function getSettlementReuseMaxAgeMs() {
  const raw = parseInt(process.env.MP_SETTLEMENT_REUSE_MAX_AGE_MS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : SETTLEMENT_REUSE_MAX_AGE_MS_DEFAULT;
}

/**
 * Reporte listo, generado hace como máximo `maxAgeMs`, que empieza antes o en el
 * inicio del rango pedido y termina a menos de `maxAgeMs` del fin pedido.
 * Pura: no hace requests.
 */
export function findRecentCoveringReport(
  reports,
  beginDate,
  endDate,
  { maxAgeMs = getSettlementReuseMaxAgeMs(), now = Date.now() } = {}
) {
  const begin = new Date(beginDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(begin) || !Number.isFinite(end)) return null;

  return (reports || [])
    .filter((r) => isReportReady(r))
    .filter((r) => {
      const generated = reportGeneratedAt(r);
      if (!generated || now - generated > maxAgeMs) return false;
      const rBegin = new Date(r.begin_date).getTime();
      const rEnd = new Date(r.end_date).getTime();
      if (!Number.isFinite(rBegin) || !Number.isFinite(rEnd)) return false;
      return rBegin <= begin + DAY_MS && rEnd >= end - maxAgeMs;
    })
    .sort((a, b) => reportGeneratedAt(b) - reportGeneratedAt(a))[0] || null;
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

  getSettlementConfigBody(existing = null) {
    // include_withdraw es crítico para CVU→CBU (WITHDRAWAL).
    // MP exige frequency en PUT; hay que preservar el de la config existente.
    const baseColumns = [
      { key: 'TRANSACTION_DATE' },
      { key: 'SOURCE_ID' },
      { key: 'EXTERNAL_REFERENCE' },
      { key: 'TRANSACTION_TYPE' },
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
    ];
    const existingCols = Array.isArray(existing?.columns) ? existing.columns : null;
    const hasDescription = (existingCols || []).some(
      (c) => String(c.key || c).toUpperCase() === 'DESCRIPTION'
    );
    const columns = existingCols?.length
      ? hasDescription
        ? existingCols
        : [...existingCols, { key: 'DESCRIPTION' }]
      : baseColumns;

    return {
      file_name_prefix:
        existing?.file_name_prefix || `attadia-settlement-${this.userId || 'mp'}`,
      show_fee_prevision: existing?.show_fee_prevision ?? false,
      show_chargeback_cancel: existing?.show_chargeback_cancel ?? true,
      include_withdraw: true,
      // Incluir retiros al borde del rango de fechas
      include_withdrawal_at_end: true,
      coupon_detailed: existing?.coupon_detailed ?? true,
      shipping_detail: existing?.shipping_detail ?? true,
      refund_detailed: existing?.refund_detailed ?? true,
      header_language: existing?.header_language || 'es',
      separator: existing?.separator || ';',
      display_timezone: existing?.display_timezone || 'GMT-03',
      frequency: existing?.frequency || {
        hour: 0,
        type: 'daily',
        value: 0,
        format: 'CSV'
      },
      columns
    };
  }

  async getReportConfig() {
    const response = await fetch(`${MP_BASE}/v1/account/settlement_report/config`, {
      headers: mpAuthHeaders(this.accessToken)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[MP Report] GET config:', response.status, errorText.slice(0, 200));
      return null;
    }
    return response.json();
  }

  async updateReportConfig(existing = null) {
    const current = existing || (await this.getReportConfig());
    const body = this.getSettlementConfigBody(current);
    const response = await fetch(`${MP_BASE}/v1/account/settlement_report/config`, {
      method: 'PUT',
      headers: mpAuthHeaders(this.accessToken),
      body: JSON.stringify(body)
    });

    if (response.status === 200 || response.status === 201) {
      const updated = await response.json();
      console.log('[MP Report] Config actualizada include_withdraw=', updated?.include_withdraw);
      return updated;
    }

    const errorText = await response.text();
    console.warn('[MP Report] Error actualizando config:', response.status, errorText);
    return null;
  }

  async configureReport() {
    const existing = await this.getReportConfig();
    if (existing) {
      if (existing.include_withdraw === true) {
        console.log('[MP Report] Config OK (include_withdraw=true)');
        return existing;
      }
      console.log('[MP Report] Config sin retiros — forzando include_withdraw=true...');
      return this.updateReportConfig(existing);
    }

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

  /** Espera el reporte y devuelve su metadato (id, fechas, file_name). */
  async waitForReport(beginDate, endDate, options = {}) {
    const {
      pollIntervalMs,
      maxPollAttempts,
      reportId = null,
      createdAfterMs = 0
    } = { ...getSettlementPollConfig(), ...options };

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      const reports = await this.listReports();
      const match = findStrictReportMatch(reports, beginDate, endDate, {
        afterMs: createdAfterMs,
        reportId
      });
      const fileName = reportFileName(match);

      if (fileName) {
        if (attempt > 0 || reportId || createdAfterMs) {
          console.log('[MP Report] Reporte listo', {
            fileName,
            id: match?.id,
            generation: match?.generation_date,
            typesHint: 'download next'
          });
        }
        return match;
      }
    }

    throw new SettlementReportTimeoutError(
      'Timeout esperando generación del reporte settlement',
      { beginDate, endDate }
    );
  }

  async completeReport(beginDate, endDate, pollOptions = {}) {
    const report = await this.waitForReport(beginDate, endDate, pollOptions);
    const fileName = reportFileName(report);
    const csvText = await this.downloadReport(fileName);
    const rows = parseSettlementCsv(csvText);
    return { rows, fileName, total: rows.length, report: reportMeta(report) };
  }

  /**
   * Descarga y mergea reportes ya existentes que cubran el rango (sin crear uno nuevo).
   */
  async reuseExistingReports(beginDate, endDate) {
    const reports = await this.listReports();
    const strict = findStrictReportMatch(reports, beginDate, endDate);
    const overlapping = findOverlappingReports(reports, beginDate, endDate);
    // Los reportes de confianza primero: son los únicos que traen retiros. Tope para no bajar
    // un centenar de diarios cuando el rango es largo.
    const ordenados = [
      ...(strict ? [strict] : []),
      ...overlapping.filter((r) => esReporteConfiable(r)),
      ...overlapping.filter((r) => !esReporteConfiable(r))
    ];
    const candidates = ordenados.filter((r, i) => ordenados.findIndex((x) => x.id === r.id) === i).slice(0, MAX_REUSE_REPORTS);

    if (!candidates.length) {
      return null;
    }

    const byId = new Map();
    const fileNames = [];
    const usados = [];
    for (const report of candidates) {
      const fileName = reportFileName(report);
      if (!fileName || fileNames.includes(fileName)) continue;
      try {
        const csvText = await this.downloadReport(fileName);
        const rows = parseSettlementCsv(csvText);
        fileNames.push(fileName);
        usados.push(report);
        for (const row of rows) {
          const key = String(row.sourceId || row.id || '');
          if (key && !byId.has(key)) byId.set(key, row);
        }
      } catch (error) {
        console.warn(`[MP Report] No se pudo reutilizar ${fileName}:`, error.message);
      }
    }

    if (!fileNames.length) return null;

    // Solo cuenta como cobertura de retiros la unión de los reportes de confianza.
    const ventanas = ventanasDeConfianza(usados);
    const trustedCoverage = coberturaCubre(ventanas, beginDate, endDate, {
      toleranciaInicioMs: REUSE_BEGIN_TOLERANCE_MS,
      toleranciaFinMs: getSettlementReuseMaxAgeMs()
    });

    console.log('[MP Report] Reutilizando reportes existentes:', {
      beginDate,
      endDate,
      files: fileNames,
      rows: byId.size,
      trustedCoverage
    });

    return {
      rows: Array.from(byId.values()),
      fileName: fileNames[0],
      fileNames,
      total: byId.size,
      reused: true,
      strictMatch: Boolean(strict),
      trustedCoverage,
      ventanas
    };
  }

  /**
   * Reutiliza un reporte de confianza generado en las últimas horas que cubra el rango.
   * No consume cupo de creación. Devuelve null si no hay candidato apto.
   */
  async reuseRecentCoveringReport(beginDate, endDate, options = {}) {
    const reports = await this.listReports();
    const recent = findRecentCoveringReport(
      (reports || []).filter((r) => esReporteConfiable(r)),
      beginDate,
      endDate,
      options
    );
    if (!recent) return null;

    const fileName = reportFileName(recent);
    const rows = parseSettlementCsv(await this.downloadReport(fileName));

    console.log('[MP Report] Reutilizando reporte de confianza reciente (sin crear nuevo):', {
      beginDate,
      endDate,
      fileName,
      rows: rows.length
    });
    return {
      rows,
      fileName,
      total: rows.length,
      reused: true,
      strictMatch: false,
      recent: true,
      report: reportMeta(recent),
      trusted: true,
      ventanasValidadas: ventanasDeConfianza([recent])
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
      const result = await this.completeReport(pending.beginDate, pending.endDate, {
        ...pollOptions,
        reportId: pending.reportId ?? pollOptions.reportId ?? null
      });
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

    // Siempre asegurar include_withdraw antes de crear/reusar. Sin retiros activos, un reporte
    // nuevo no es de confianza: el rango no se puede dar por validado.
    const config = await this.configureReport();
    const retirosActivos = config?.include_withdraw === true;

    if (options.pending) {
      const pendingResult = await this.tryCompletePendingReport(options.pending, pollOptions);
      if (pendingResult?.completed) {
        return this.marcarConfianza(
          {
            rows: pendingResult.rows,
            fileName: pendingResult.fileName,
            total: pendingResult.total,
            report: pendingResult.report,
            fromPending: true
          },
          retirosActivos
        );
      }
      if (pendingResult?.expired) {
        console.log('[MP Report] Reporte pendiente expirado, solicitando uno nuevo...');
      } else if (pendingResult && !pendingResult.completed) {
        // MP sigue generándolo. Si ya hay reportes de confianza que cubren el rango, alcanza;
        // si no, el tramo queda pendiente CON el id del reporte para completarlo en la próxima sync.
        const reusedPending = await this.reuseExistingReports(beginDate, endDate);
        if (reusedPending?.trustedCoverage) {
          return { ...reusedPending, trusted: true, ventanasValidadas: reusedPending.ventanas };
        }
        const rowsPending = reusedPending?.rows || [];
        return {
          rows: rowsPending,
          pending: true,
          partial: rowsPending.length > 0,
          missingWithdrawals: true,
          reportId: options.pending.reportId ?? null,
          beginDate: options.pending.beginDate,
          endDate: options.pending.endDate
        };
      }
    }

    // Reporte de confianza generado hace poco que cubre el rango: reutilizarlo sin crear otro.
    try {
      const recentReuse = await this.reuseRecentCoveringReport(beginDate, endDate);
      if (recentReuse) return recentReuse;
    } catch (error) {
      console.warn('[MP Report] Reuso de reporte reciente falló:', error.message);
    }

    // Si los reportes de confianza ya existentes cubren el rango, reutilizarlos sin quemar el
    // cupo diario de MP (429). Los reportes sin retiros nunca alcanzan.
    let reusedFallback = null;
    try {
      reusedFallback = await this.reuseExistingReports(beginDate, endDate);
      if (reusedFallback?.trustedCoverage) {
        console.log('[MP Report] Reutilizando reportes de confianza que cubren el rango (sin crear nuevo):', {
          beginDate,
          endDate,
          files: reusedFallback.fileNames,
          rows: reusedFallback.rows.length
        });
        return { ...reusedFallback, trusted: true, ventanasValidadas: reusedFallback.ventanas };
      }
    } catch (error) {
      console.warn('[MP Report] Reuso previo falló:', error.message);
    }

    let createdMeta = null;
    const createdAfterMs = Date.now();
    try {
      createdMeta = await this.createReport(beginDate, endDate);
      console.log('[MP Report] Reporte solicitado', {
        beginDate,
        endDate,
        id: createdMeta?.data?.id,
        status: createdMeta?.data?.status
      });
    } catch (error) {
      if (error instanceof SettlementReportQuotaError || isQuotaExceededError(error)) {
        console.warn('[MP Report] Cupo de reportes agotado (429). Reutilizando existentes...');
        const reused =
          reusedFallback || (await this.reuseExistingReports(beginDate, endDate));
        if (reused?.trustedCoverage) {
          return { ...reused, trusted: true, ventanasValidadas: reused.ventanas };
        }
        if (reused?.rows?.length) {
          return {
            ...reused,
            partial: true,
            quotaExceeded: true,
            missingWithdrawals: true
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
      const result = await this.completeReport(beginDate, endDate, {
        ...pollOptions,
        reportId: createdMeta?.data?.id || null,
        createdAfterMs
      });
      const withdrawals = (result.rows || []).filter((r) => esTipoRetiro(r.transactionType)).length;
      console.log('[MP Report] CSV nuevo', {
        fileName: result.fileName,
        rows: result.rows?.length,
        withdrawals
      });
      return this.marcarConfianza(result, retirosActivos);
    } catch (error) {
      if (error instanceof SettlementReportTimeoutError) {
        // El reporte existe en MP pero todavía no está listo: se guarda su id para completarlo
        // en la próxima sync. Nunca se da por bueno un reuso sin retiros.
        const reused =
          reusedFallback || (await this.reuseExistingReports(beginDate, endDate));
        if (reused?.trustedCoverage) {
          return { ...reused, trusted: true, ventanasValidadas: reused.ventanas };
        }
        const rowsTimeout = reused?.rows || [];
        return {
          rows: rowsTimeout,
          pending: true,
          partial: rowsTimeout.length > 0,
          missingWithdrawals: true,
          reportId: createdMeta?.data?.id != null ? String(createdMeta.data.id) : null,
          beginDate,
          endDate
        };
      }
      throw error;
    }
  }

  /** Marca el resultado como de confianza y calcula las ventanas que valida. */
  marcarConfianza(result, retirosActivos = true) {
    const meta = result?.report || null;
    const trusted = Boolean(meta) && retirosActivos && esReporteConfiable(meta);
    return {
      ...result,
      trusted,
      ventanasValidadas: trusted ? ventanasDeConfianza([meta]) : []
    };
  }

  parseCsvContent(csvText) {
    return parseSettlementCsv(csvText);
  }
}
