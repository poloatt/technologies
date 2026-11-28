import fetch from 'node-fetch';
import { mpAuthHeaders } from './mercadoPagoUtils.js';

const MP_BASE = 'https://api.mercadopago.com';

/* ------------------------------------------------------------------ */
/* Parseo y validación (puro)                                          */
/* ------------------------------------------------------------------ */

function detectarSeparador(headerLine = '') {
  const comas = (headerLine.match(/,/g) || []).length;
  const puntoComa = (headerLine.match(/;/g) || []).length;
  return puntoComa > comas ? ';' : ',';
}

function partirLinea(line, sep) {
  const celdas = [];
  let actual = '';
  let enComillas = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (enComillas && line[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        enComillas = !enComillas;
      }
    } else if (c === sep && !enComillas) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas;
}

function numero(value) {
  if (value == null) return null;
  let texto = String(value).trim();
  if (!texto) return null;
  // "1.234,56" → 1234.56 ; "1234.56" queda igual.
  if (texto.includes(',') && !texto.includes('.')) texto = texto.replace(',', '.');
  else if (texto.includes(',') && texto.includes('.')) texto = texto.replace(/\./g, '').replace(',', '.');
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/**
 * CSV del reporte de liberaciones → filas normalizadas.
 * Tolera separador `,` o `;` y nombres de columna en mayúsculas (los que arma MP).
 */
export function parseReleaseCsv(csvText = '') {
  const lineas = String(csvText || '').split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const sep = detectarSeparador(lineas[0]);
  const header = partirLinea(lineas[0], sep).map((h) => h.trim().replace(/^\uFEFF/, '').toUpperCase());
  const col = (nombre) => header.indexOf(nombre);
  const iFecha = col('DATE');
  const iId = col('SOURCE_ID');
  const iRef = col('EXTERNAL_REFERENCE');
  const iTipo = col('RECORD_TYPE');
  const iDesc = col('DESCRIPTION');
  const iCredito = col('NET_CREDIT_AMOUNT');
  const iDebito = col('NET_DEBIT_AMOUNT');
  const iSaldo = col('BALANCE_AMOUNT');
  const iCuenta = col('PAYOUT_BANK_ACCOUNT_NUMBER');

  return lineas.slice(1).map((linea) => {
    const c = partirLinea(linea, sep);
    const at = (i) => (i >= 0 ? (c[i] ?? '').trim() : '');
    return {
      fecha: at(iFecha) || null,
      sourceId: at(iId) || null,
      externalReference: at(iRef) || null,
      tipo: at(iTipo).toLowerCase(),
      descripcion: at(iDesc),
      credito: numero(at(iCredito)) ?? 0,
      debito: Math.abs(numero(at(iDebito)) ?? 0),
      saldo: numero(at(iSaldo)),
      cuentaDestino: at(iCuenta) || null,
    };
  });
}

const esApertura = (r) => /initial/.test(r.tipo) && /balance/.test(r.tipo);
const esCierre = (r) => r.tipo === 'total' || (/final|closing/.test(r.tipo) && /balance/.test(r.tipo));
const esSaldoMarcador = (r) => esApertura(r) || esCierre(r);

/**
 * Saldo inicial + créditos − débitos debe dar el saldo final, y el saldo corrido no puede
 * tener saltos. Detecta un archivo truncado o filas que el reporte no trae.
 */
export function validarSaldoCorrido(rows = [], { tolerancia = 1 } = {}) {
  const lista = rows || [];
  const apertura = lista.find(esApertura);
  const cierre = [...lista].reverse().find(esCierre);
  const movimientos = lista.filter((r) => !esSaldoMarcador(r));

  if (!apertura || !cierre || apertura.saldo == null || cierre.saldo == null) {
    return { ok: false, motivo: 'sin_saldos', movimientos: movimientos.length, saltos: [] };
  }

  let calculado = apertura.saldo;
  const saltos = [];
  for (const r of movimientos) {
    const previo = calculado;
    calculado += (r.credito || 0) - (r.debito || 0);
    if (r.saldo != null && Math.abs(r.saldo - calculado) > 0.01 && saltos.length < 20) {
      saltos.push({ fecha: r.fecha, sourceId: r.sourceId, esperado: Math.round(calculado * 100) / 100, saldo: r.saldo, previo });
      calculado = r.saldo; // re-sincroniza para no reportar el mismo salto en cadena
    }
  }
  const diferencia = Math.round((calculado - cierre.saldo) * 100) / 100;
  return {
    ok: Math.abs(diferencia) <= tolerancia && saltos.length === 0,
    apertura: apertura.saldo,
    cierre: cierre.saldo,
    calculado: Math.round(calculado * 100) / 100,
    diferencia,
    movimientos: movimientos.length,
    saltos,
  };
}

/** Retiros a banco del reporte de liberaciones (con la cuenta destino si viene). */
export function payoutsDeRelease(rows = []) {
  return (rows || [])
    .filter((r) => !esSaldoMarcador(r) && (/payout|withdraw/.test(r.tipo) || r.cuentaDestino))
    .map((r) => ({
      id: r.sourceId ? String(r.sourceId) : '',
      amount: Math.round((r.debito || Math.abs(r.credito || 0)) * 100) / 100,
      date: r.fecha,
      cuentaDestino: r.cuentaDestino,
    }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cruza los retiros del settlement con los del reporte de liberaciones.
 * Primero por id; lo que no cruza por id se empareja por monto y fecha (±1 día).
 * `settlement`: [{ id, amount, date }], `release`: [{ id, amount, date, cuentaDestino }]
 */
export function compararRetirosConRelease(settlement = [], release = []) {
  const restoRelease = [...release];
  const pares = [];
  const sinPar = [];

  for (const s of settlement) {
    const idx = restoRelease.findIndex((r) => r.id && r.id === String(s.id));
    if (idx >= 0) {
      pares.push({ settlement: s, release: restoRelease[idx], por: 'id' });
      restoRelease.splice(idx, 1);
    } else {
      sinPar.push(s);
    }
  }

  const soloSettlement = [];
  for (const s of sinPar) {
    const t = new Date(s.date).getTime();
    const idx = restoRelease.findIndex(
      (r) => Math.abs(r.amount - s.amount) < 0.01 && Math.abs(new Date(r.date).getTime() - t) <= DAY_MS
    );
    if (idx >= 0) {
      pares.push({ settlement: s, release: restoRelease[idx], por: 'monto_fecha' });
      restoRelease.splice(idx, 1);
    } else {
      soloSettlement.push(s);
    }
  }

  return {
    ok: soloSettlement.length === 0 && restoRelease.length === 0,
    pares,
    soloSettlement,
    soloRelease: restoRelease,
  };
}

/**
 * Validación completa de un rango con el reporte de liberaciones.
 * `retirosSettlement`: salida de `extraerRetiros` (solo salidas, sin cancelaciones).
 */
export function validarRangoConRelease({ releaseRows = [], retirosSettlement = [] } = {}) {
  const saldo = validarSaldoCorrido(releaseRows);
  const salidas = (retirosSettlement || []).filter((r) => !r.cancel);
  const cruce = compararRetirosConRelease(salidas, payoutsDeRelease(releaseRows));
  return {
    ok: saldo.ok && cruce.ok,
    saldo,
    cruce: {
      ok: cruce.ok,
      pares: cruce.pares.length,
      soloSettlement: cruce.soloSettlement,
      soloRelease: cruce.soloRelease,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Cliente de la API                                                   */
/* ------------------------------------------------------------------ */

export class MercadoPagoReleaseReportService {
  constructor({ accessToken }) {
    this.accessToken = accessToken;
  }

  async getConfig() {
    const res = await fetch(`${MP_BASE}/v1/account/release_report/config`, {
      headers: mpAuthHeaders(this.accessToken),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`release_report config: ${res.status} - ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  getConfigBody(existing = null) {
    return {
      file_name_prefix: existing?.file_name_prefix || 'attadia-release',
      display_timezone: existing?.display_timezone || 'GMT-03',
      report_translation: existing?.report_translation || 'es',
      include_withdrawal_at_end: true,
      scheduled: false,
      execute_after_withdrawal: false,
      ...(Array.isArray(existing?.columns) && existing.columns.length ? { columns: existing.columns } : {}),
    };
  }

  async configure() {
    const existing = await this.getConfig();
    const body = this.getConfigBody(existing);
    const res = await fetch(`${MP_BASE}/v1/account/release_report/config`, {
      method: existing ? 'PUT' : 'POST',
      headers: mpAuthHeaders(this.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`release_report configurar: ${res.status} - ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  async createReport(beginDate, endDate) {
    const res = await fetch(`${MP_BASE}/v1/account/release_report`, {
      method: 'POST',
      headers: mpAuthHeaders(this.accessToken),
      body: JSON.stringify({ begin_date: beginDate, end_date: endDate }),
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (res.status === 429) {
      const err = new Error(`release_report cupo agotado: ${text.slice(0, 200)}`);
      err.quotaExceeded = true;
      throw err;
    }
    if (![200, 202, 203].includes(res.status)) {
      throw new Error(`release_report crear: ${res.status} - ${text.slice(0, 300)}`);
    }
    return data;
  }

  async listReports() {
    const res = await fetch(`${MP_BASE}/v1/account/release_report/list`, {
      headers: mpAuthHeaders(this.accessToken),
    });
    if (!res.ok) throw new Error(`release_report listar: ${res.status} - ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  }

  async download(fileName) {
    const res = await fetch(`${MP_BASE}/v1/account/release_report/${encodeURIComponent(fileName)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'User-Agent': 'Attadia/1.0' },
    });
    if (!res.ok) throw new Error(`release_report descargar: ${res.status} - ${(await res.text()).slice(0, 200)}`);
    return res.text();
  }

  /**
   * Pide un reporte del rango y espera. Devuelve `{ rows, fileName }` o
   * `{ pending: true, reportId }` si MP todavía lo está generando (se completa en la próxima sync).
   */
  async fetchRange(beginDate, endDate, { reportId = null, pollIntervalMs = 3000, maxPollAttempts = 10 } = {}) {
    await this.configure();
    const creadoDespuesDe = Date.now();
    let id = reportId;
    if (!id) {
      const creado = await this.createReport(beginDate, endDate);
      id = creado?.id ?? null;
    }
    for (let intento = 0; intento < maxPollAttempts; intento += 1) {
      if (intento > 0) await new Promise((r) => setTimeout(r, pollIntervalMs));
      const reportes = await this.listReports();
      const listo = reportes.find((r) => {
        const estado = String(r.status || '').toLowerCase();
        const ok = r.file_name && (!estado || estado === 'processed' || estado === 'ready');
        if (!ok) return false;
        if (id != null) return String(r.id) === String(id);
        return new Date(r.date_created || r.last_modified || 0).getTime() >= creadoDespuesDe - 5000;
      });
      if (listo?.file_name) {
        const rows = parseReleaseCsv(await this.download(listo.file_name));
        return { rows, fileName: listo.file_name, reportId: listo.id };
      }
    }
    return { pending: true, reportId: id };
  }
}
