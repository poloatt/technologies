/** Mirror de MP_TRANSACTION_TYPE_LABELS (backend mercadoPagoUtils.js) para display-time. */
export const MP_TRANSACTION_TYPE_LABELS = {
  SETTLEMENT: 'Pago aprobado',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  DISPUTE: 'Reclamo',
  WITHDRAWAL: 'Transferencia bancaria',
  WITHDRAWAL_CANCEL: 'Transferencia cancelada',
  PAYOUT: 'Transferencia bancaria',
  PAYOUTS: 'Transferencia bancaria',
  TRANSFER: 'Transferencia',
  MONEY_TRANSFER: 'Transferencia',
  BANK_TRANSFER: 'Transferencia bancaria',
  CASHBACK: 'Cashback',
  SETTLEMENT_SHIPPING: 'Envío aprobado',
  REFUND_SHIPPING: 'Devolución de envío',
  CHARGEBACK_SHIPPING: 'Contracargo de envío',
  DISPUTE_SHIPPING: 'Reclamo de envío',
};

export const MP_MOVEMENT_KIND_LABELS = {
  PAYMENT: 'Pago',
  P2P_TRANSFER: 'Transferencia a usuario',
  EXTERNAL_TRANSFER: 'Transferencia bancaria',
  CASH_WITHDRAWAL: 'Retiro de efectivo',
  // Copy corto: son moves internos, no plata que entra/sale
  RESERVE_RELEASE: 'Desde reserva',
  RESERVE_LOCK: 'A reserva',
  INVESTMENT_IN: 'A inversión',
  INVESTMENT_OUT: 'Desde inversión',
  INVESTMENT_YIELD: 'Rendimiento',
  YIELD: 'Rendimiento',
  CASHBACK: 'Cashback',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  FEE: 'Comisión',
  INTERNAL: 'Ajuste interno',
  UNKNOWN: 'Movimiento',
};

const INTERNAL_MOVEMENT_KINDS = new Set([
  'RESERVE_LOCK',
  'RESERVE_RELEASE',
  'INTERNAL',
]);

const MANUAL_LEDGER_KINDS = new Set([
  'RESERVE_LOCK',
  'RESERVE_RELEASE',
  'INVESTMENT_IN',
  'INVESTMENT_OUT',
]);

const YIELD_LEDGER_KINDS = new Set([
  'INVESTMENT_YIELD',
  'YIELD',
]);

function ledgerMovementKind(origenOrTx) {
  const origen = origenOrTx?.origen ? origenOrTx.origen : origenOrTx;
  return String(getOrigenMetadata(origen).movementKind || '');
}

export function isYieldLedgerRow(origenOrTx) {
  return YIELD_LEDGER_KINDS.has(ledgerMovementKind(origenOrTx));
}

function ledgerDateLabel(transaccion) {
  if (!transaccion?.fecha) return '';
  const date = new Date(transaccion.fecha);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function yieldSourceLabel(transaccion) {
  const meta = getOrigenMetadata(transaccion?.origen);
  const blob = [meta.description, meta.operationType, meta.businessBranch, transaccion?.descripcion]
    .filter(Boolean)
    .join(' ');
  if (/asset_management|inversi[oó]n/i.test(blob)) return 'inversión';
  if (/\breserva\b|pot-to-am|am-to-pot/i.test(blob)) return 'reserva';
  return 'dinero en cuenta';
}

/** Una sola frase para la fila de Inversiones: tipo y fecha, sin repetir el título. */
export function ledgerCompactLabel(transaccion) {
  const kind = ledgerMovementKind(transaccion);
  const date = ledgerDateLabel(transaccion);
  const dated = (label) => (date ? `${label} · ${date}` : label);
  // "in" es plata que el usuario manda a la reserva (sale del disponible, signo −).
  // "out" es plata que saca de la reserva (vuelve al disponible, signo +).
  if (kind === 'RESERVE_LOCK') return dated('Reserva in');
  if (kind === 'RESERVE_RELEASE') return dated('Reserva out');
  if (kind === 'INVESTMENT_IN') return dated('Invertido');
  if (kind === 'INVESTMENT_OUT') return dated('Rescatado');
  if (kind === 'FX_SELL' || kind === 'FX_BUY') {
    const usd = Number(getOrigenMetadata(transaccion?.origen).usdAmount);
    const cantidad = Number.isFinite(usd) && usd > 0
      ? ` U$D ${usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '';
    return dated(`${kind === 'FX_SELL' ? 'Vendiste' : 'Compraste'}${cantidad}`);
  }
  if (YIELD_LEDGER_KINDS.has(kind)) return dated(`Rendimiento · ${yieldSourceLabel(transaccion)}`);
  return null;
}

export function isNeutralLedgerRow(origenOrTx) {
  const kind = ledgerMovementKind(origenOrTx);
  return MANUAL_LEDGER_KINDS.has(kind) || YIELD_LEDGER_KINDS.has(kind);
}

export function neutralLedgerCaption(transaccion) {
  const kind = String(getOrigenMetadata(transaccion?.origen).movementKind || '');
  if (YIELD_LEDGER_KINDS.has(kind)) {
    return 'Rendimiento generado por la reserva, una inversión o el dinero en cuenta.';
  }
  if (kind === 'INVESTMENT_IN') {
    return 'Salió de la cuenta hacia el FCI. No es un rendimiento.';
  }
  if (kind === 'INVESTMENT_OUT') {
    return 'Volvió del FCI a la cuenta. No es un rendimiento.';
  }
  return 'Movimiento manual entre disponible y reserva. No es un rendimiento.';
}

export function neutralLedgerOrigin(transaccion) {
  const kind = String(getOrigenMetadata(transaccion?.origen).movementKind || '');
  if (YIELD_LEDGER_KINDS.has(kind)) return 'Rendimiento';
  if (kind === 'INVESTMENT_IN') return 'Hacia el FCI';
  if (kind === 'INVESTMENT_OUT') return 'Rescate';
  return 'Disponible ↔ reserva';
}

const LEDGER_VISIBLE_KINDS = new Set([
  'INVESTMENT_IN',
  'INVESTMENT_OUT',
  'INVESTMENT_YIELD',
  'YIELD',
  'CASHBACK',
]);

// Códigos crudos de parking/reserva en Account Money AR (aparecen como “contraparte”)
// Ojo: no usar "wallet" suelto — suele ser pago real con dinero en cuenta.
const MP_INTERNAL_CODE_RE =
  /\b(digital_accounts(?:_cards)?|reserve_for_|asset_management(?:_withdrawal|_deposit)?|parking|money_park|unpark)\b/i;

/**
 * Detecta textos/códigos de movimientos internos MP (disponible ↔ reserva).
 */
export function looksLikeMpInternalReserveText(...parts) {
  const blob = parts.filter(Boolean).join(' ').trim();
  if (!blob) return false;
  if (MP_INTERNAL_CODE_RE.test(blob)) return true;
  if (/desde\s+(?:(?:la|tu|mi)\s+)?reserva|a\s+(?:(?:la|tu|mi)\s+)?reserva|env[ií]o\s+a\s+reserva|extracci[oó]n\s+de\s+reserva/i.test(blob)) {
    return true;
  }
  return false;
}

/**
 * Movimientos dentro de la misma cuenta (disponible ↔ reserva).
 * No deben verse como ingreso/egreso de dinero.
 * Acepta origen solo, o la transacción completa (para txs ya sync sin movementKind).
 */
export function isMpInternalAccountMovement(origenOrTx) {
  const origen = origenOrTx?.origen ? origenOrTx.origen : origenOrTx;
  const meta = getOrigenMetadata(origen);
  if (LEDGER_VISIBLE_KINDS.has(meta.movementKind) || String(meta.movementKind || '').startsWith('INVESTMENT')) {
    return false;
  }
  if (INTERNAL_MOVEMENT_KINDS.has(meta.movementKind)) return true;
  if (String(meta.movementKind || '').startsWith('RESERVE')) return true;
  if (meta.isInternal === true && meta.statsExclude === true) return true;

  // Txs ya sincronizadas: MP guarda códigos crudos (digital_accounts, wallet…)
  return looksLikeMpInternalReserveText(
    meta.counterpartyName,
    meta.businessName,
    meta.itemTitle,
    meta.description,
    meta.statementDescriptor,
    origenOrTx?.descripcion
  );
}

/** Título corto para fila interna según dirección del movimiento. */
export function formatMpInternalReserveTitle(transaccion) {
  const meta = getOrigenMetadata(transaccion?.origen);
  if (meta.movementKind && MP_MOVEMENT_KIND_LABELS[meta.movementKind]) {
    return MP_MOVEMENT_KIND_LABELS[meta.movementKind];
  }
  if (meta.movementKind === 'INTERNAL') return MP_MOVEMENT_KIND_LABELS.INTERNAL;
  // Sin kind: inferir por signo
  if (transaccion?.tipo === 'EGRESO') return MP_MOVEMENT_KIND_LABELS.RESERVE_LOCK;
  if (transaccion?.tipo === 'INGRESO') return MP_MOVEMENT_KIND_LABELS.RESERVE_RELEASE;
  return 'Ajuste interno';
}

const MP_ORIGEN_TIPOS = ['MERCADOPAGO_PAGO', 'MERCADOPAGO_MOVIMIENTO', 'MERCADOPAGO'];

const PAYMENT_METHOD_LABELS = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  prepaid_card: 'Tarjeta prepaga',
  ticket: 'Efectivo / ticket',
  bank_transfer: 'Transferencia',
  account_money: 'Dinero en cuenta',
  digital_currency: 'Moneda digital',
  atm: 'Cajero',
};

export function isMercadoPagoOrigen(origen) {
  if (!origen?.tipo) return false;
  return MP_ORIGEN_TIPOS.includes(origen.tipo);
}

export function mapearTipoTransaccionMpDisplay(type) {
  if (!type) return null;
  const key = String(type).toUpperCase();
  return MP_TRANSACTION_TYPE_LABELS[key] || null;
}

export function getOrigenMetadata(origen) {
  if (!origen?.metadata) return {};
  if (typeof origen.metadata.get === 'function') {
    const obj = {};
    origen.metadata.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return origen.metadata;
}

export function formatPaymentMethodLabel(method, methodId) {
  if (!method && !methodId) return null;
  const base = PAYMENT_METHOD_LABELS[method] || method || null;
  if (methodId && methodId !== method) {
    const id = String(methodId).replace(/_/g, ' ');
    return base ? `${base} · ${id}` : id;
  }
  return base;
}

const GENERIC_COUNTERPARTY_SET = new Set([
  ...Object.values(MP_TRANSACTION_TYPE_LABELS),
  ...Object.keys(MP_TRANSACTION_TYPE_LABELS),
  ...Object.values(MP_MOVEMENT_KIND_LABELS),
  ...Object.keys(MP_MOVEMENT_KIND_LABELS),
  ...Object.values(PAYMENT_METHOD_LABELS),
  ...Object.keys(PAYMENT_METHOD_LABELS),
  'MercadoPago',
  'Mercado Pago',
  'MercadoLibre',
  'Mercado Libre',
  'Pago',
  'Pago con QR',
  'Pago QR',
  'Movimiento',
  'Movimiento Mercado Pago',
  'Transferencia',
  'Transferencia bancaria',
  'Dinero en cuenta',
  'Tarjeta de credito',
  'Tarjeta de debito',
  'Devolucion',
  'Comision',
  'Retiro',
  'account_money',
  'available_money',
  'credit_card',
  'debit_card',
  'prepaid_card',
  'bank_transfer',
  'debin_transfer',
  'money_transfer',
  'account_fund',
  'regular_payment',
  'pos_payment',
  'cvu',
  'cbu',
  'ticket',
  'atm',
  'digital_accounts',
  'digital_accounts_cards',
  'wallet',
  'marketplace',
  'online_payments',
  'point',
  'qr',
  'mobile_app',
  'instore',
  'p2p',
].map((v) => String(v).toLowerCase()));

const SYNTHETIC_MERCHANT_RE = /^comercio\s*#\d+$/i;
const EMPTY_ITEM_TITLE_RE = /^(?:producto\s+)?sin\s+descripci[oó]n$/i;
const COUNTERPARTY_PREFIX_RE =
  /^(?:pago\s+(?:a|en)|pagaste\s+a|compra\s+en|transferencia\s+(?:a|de|hacia|desde|enviada\s+a|recibida\s+de)|transferiste\s+a|recibiste\s+de|env[ií]o\s+(?:de\s+dinero\s+)?(?:a|de))\s+/i;

function isSyntheticMerchantId(name) {
  return Boolean(name && SYNTHETIC_MERCHANT_RE.test(String(name).trim()));
}

function isGenericCounterpartyName(name) {
  if (!name) return true;
  const cleaned = String(name).trim();
  if (!cleaned) return true;
  if (EMPTY_ITEM_TITLE_RE.test(cleaned)) return true;
  if (looksLikeMpInternalReserveText(cleaned)) return true;
  const lower = cleaned.toLowerCase();
  if (GENERIC_COUNTERPARTY_SET.has(lower)) return true;

  // Etiquetas compuestas de medio de pago, ej: "Dinero en cuenta · account money"
  const parts = lower.split(/\s*[·]\s*/).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => GENERIC_COUNTERPARTY_SET.has(part) || GENERIC_COUNTERPARTY_SET.has(part.replace(/\s+/g, '_')))) {
    return true;
  }
  return false;
}

function cleanCounterpartyCandidate(raw, { stripPrefix = false } = {}) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || isGenericCounterpartyName(trimmed)) return null;
  if (stripPrefix) {
    const stripped = trimmed.replace(COUNTERPARTY_PREFIX_RE, '').trim();
    if (stripped && !isGenericCounterpartyName(stripped)) return stripped;
  }
  return trimmed;
}

function extractCounterpartyFromDescripcion(descripcion, origen) {
  const formatted = formatMpTransactionDescription(descripcion, origen);
  const cleaned = (formatted || '')
    .replace(/^MercadoPago\s*[-–—]\s*/i, '')
    .replace(/\s*\(Ref:[^)]*\)\s*$/i, '')
    .trim();
  if (!cleaned) return null;

  const withoutMethodSuffix = cleaned.split(' · ')[0].trim();
  if (!withoutMethodSuffix) return null;

  // Soporta formatos como "account_money - Farmacity" o "Transferencia - Juan Perez"
  const segments = withoutMethodSuffix.split(/\s+[-–—]\s+/);
  for (const segment of segments) {
    const candidate = cleanCounterpartyCandidate(segment, { stripPrefix: true });
    if (candidate && !isSyntheticMerchantId(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getCounterparty(transaccion) {
  const meta = getOrigenMetadata(transaccion?.origen);
  const isTransfer = Boolean(
    meta.isTransfer ||
    meta.movementKind === 'EXTERNAL_TRANSFER' ||
    meta.movementKind === 'P2P_TRANSFER' ||
    String(meta.operationType || '').toLowerCase() === 'money_transfer'
  );
  const defaultLabel = transaccion?.tipo === 'EGRESO'
    ? (isTransfer ? 'Transferiste a' : 'Pagaste a')
    : 'Recibiste de';

  const metaCandidates = [
    { value: meta.counterpartyName, stripPrefix: false },
    { value: meta.businessName, stripPrefix: false },
    { value: meta.statementDescriptor, stripPrefix: false },
    { value: meta.itemTitle, stripPrefix: false },
    { value: meta.description, stripPrefix: true },
  ];

  let syntheticFallback = null;
  for (const { value, stripPrefix } of metaCandidates) {
    const cleaned = cleanCounterpartyCandidate(value, { stripPrefix });
    if (!cleaned) continue;
    if (isSyntheticMerchantId(cleaned)) {
      if (!syntheticFallback) syntheticFallback = cleaned;
      continue;
    }
    return {
      name: cleaned,
      label: meta.counterpartyLabel || defaultLabel,
      role: meta.counterpartyRole || null,
      email: meta.counterpartyEmail || null,
    };
  }

  // Fallback: inferir desde descripción (sin usar "Pago aprobado" / "Dinero en cuenta" como negocio)
  const fromDescripcion = extractCounterpartyFromDescripcion(
    transaccion?.descripcion,
    transaccion?.origen
  );
  if (fromDescripcion) {
    return {
      name: fromDescripcion,
      label: meta.counterpartyLabel || defaultLabel,
      role: meta.counterpartyRole || null,
      email: meta.counterpartyEmail || null,
    };
  }

  if (syntheticFallback) {
    return {
      name: syntheticFallback,
      label: meta.counterpartyLabel || defaultLabel,
      role: meta.counterpartyRole || null,
      email: meta.counterpartyEmail || null,
    };
  }

  return null;
}

/**
 * Título limpio para listado (prioriza negocio / contraparte).
 */
export function formatMpTransactionTitle(descripcion, origen) {
  const counterparty = getCounterparty({ descripcion, origen });
  if (counterparty?.name && !isGenericCounterpartyName(counterparty.name)) {
    return counterparty.name;
  }

  const meta = getOrigenMetadata(origen);
  const kindLabel = MP_MOVEMENT_KIND_LABELS[meta.movementKind];
  if (kindLabel && meta.movementKind !== 'PAYMENT' && meta.movementKind !== 'UNKNOWN') {
    return kindLabel;
  }
  if (meta.isTransfer || String(meta.operationType || '').toLowerCase() === 'money_transfer') {
    return 'Transferencia';
  }

  const method = formatPaymentMethodLabel(meta.paymentMethod, meta.paymentMethodId);
  if (method) return method;

  const formatted = formatMpTransactionDescription(descripcion, origen);
  if (!formatted) return 'Movimiento Mercado Pago';

  let title = formatted.replace(/^MercadoPago\s*[-–—]\s*/i, '').trim();
  if (!title || isGenericCounterpartyName(title)) {
    return 'Movimiento Mercado Pago';
  }
  return title;
}

/** Nombre de la compra con tarjeta. El punto de interacción a veces dice solo "wallet". */
export function formatCardPurchaseTitle(transaccion) {
  const meta = getOrigenMetadata(transaccion?.origen);
  const candidates = [meta.statementDescriptor, meta.itemTitle, meta.description, meta.businessName];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (!text || /^producto sin descripci/i.test(text) || isGenericCounterpartyName(text)) continue;
    return text;
  }
  return formatMpTransactionTitle(transaccion?.descripcion, transaccion?.origen);
}

/**
 * Reemplaza códigos crudos MP (SETTLEMENT, etc.) en descripciones legacy.
 */
export function formatMpTransactionDescription(descripcion, origen) {
  if (!descripcion) return descripcion || '';

  let result = descripcion;

  Object.entries(MP_TRANSACTION_TYPE_LABELS).forEach(([code, label]) => {
    const pattern = new RegExp(`\\b${code}\\b`, 'gi');
    result = result.replace(pattern, label);
  });

  if (isMercadoPagoOrigen(origen) && result.startsWith('MercadoPago - ')) {
    return result;
  }

  return result;
}

/**
 * Meta secundaria para la fila (fecha · canal · método).
 */
export function buildTransactionListMeta(transaccion, { includeDate = true } = {}) {
  const parts = [];
  const origen = transaccion?.origen;
  const meta = getOrigenMetadata(origen);
  const metaKind = String(meta.movementKind || '');
  const internal = isMpInternalAccountMovement(origen);

  if (includeDate && transaccion?.fecha) {
    const date = new Date(transaccion.fecha);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      );
    }
  }

  // Reserva, aporte o rendimiento: una sola pista, sin ingreso/egreso.
  if (YIELD_LEDGER_KINDS.has(metaKind)) {
    parts.push('Rendimiento');
    return parts.filter(Boolean).join(' · ');
  }
  if (MANUAL_LEDGER_KINDS.has(metaKind) || internal) {
    parts.push('Movimiento manual');
    return parts.filter(Boolean).join(' · ');
  }

  if (isMercadoPagoOrigen(origen)) {
    if (origen.tipo === 'MERCADOPAGO_MOVIMIENTO') {
      parts.push('Wallet');
      const kindLabel = MP_MOVEMENT_KIND_LABELS[meta.movementKind];
      if (kindLabel) parts.push(kindLabel);
      else {
        const typeLabel = mapearTipoTransaccionMpDisplay(meta.transactionType);
        if (typeLabel) parts.push(typeLabel);
        else if (meta.isTransfer) parts.push('Transferencia');
      }
    } else {
      parts.push('Mercado Pago');
      const kindLabel = MP_MOVEMENT_KIND_LABELS[meta.movementKind];
      if (kindLabel && meta.movementKind !== 'PAYMENT') {
        parts.push(kindLabel);
      } else if (meta.isTransfer || String(meta.operationType || '').toLowerCase() === 'money_transfer') {
        parts.push('Transferencia');
      } else {
        const method = formatPaymentMethodLabel(meta.paymentMethod, meta.paymentMethodId);
        if (method) parts.push(method);
      }
      if (meta.installments > 1) parts.push(`${meta.installments} cuotas`);
    }
    // Si el título ya es la contraparte, no repetir; si no, sumar label corto
    if (meta.counterpartyLabel && meta.counterpartyName) {
      // meta line ya tiene método; el título lleva el nombre
    }
  } else if (transaccion?.categoria && transaccion.categoria !== 'Otro') {
    parts.push(transaccion.categoria);
  }

  return parts.filter(Boolean).join(' · ');
}

export function getComisionesTotal(transaccion) {
  const total = Number(transaccion?.comisiones?.total);
  if (!Number.isNaN(total) && total > 0) return total;
  const mp = Number(transaccion?.comisiones?.mercadopago) || 0;
  const fin = Number(transaccion?.comisiones?.financieras) || 0;
  const envio = Number(transaccion?.comisiones?.envio) || 0;
  const sum = mp + fin + envio;
  return sum > 0 ? sum : 0;
}

export function hasNetoDistinct(transaccion) {
  const monto = Number(transaccion?.monto);
  const neto = Number(transaccion?.montoNeto);
  if (Number.isNaN(monto) || Number.isNaN(neto)) return false;
  return Math.abs(monto - neto) > 0.009;
}

export function formatRelativeSyncTime(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return `hace ${diffD} días`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
