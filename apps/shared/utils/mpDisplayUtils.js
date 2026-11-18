/** Mirror de MP_TRANSACTION_TYPE_LABELS (backend mercadoPagoUtils.js) para display-time. */
export const MP_TRANSACTION_TYPE_LABELS = {
  SETTLEMENT: 'Pago aprobado',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  DISPUTE: 'Reclamo',
  WITHDRAWAL: 'Transferencia bancaria',
  WITHDRAWAL_CANCEL: 'Transferencia cancelada',
  PAYOUT: 'Retiro de efectivo',
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
  RESERVE_RELEASE: 'Extracción de reserva',
  RESERVE_LOCK: 'Envío a reserva',
  YIELD: 'Rendimiento',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  FEE: 'Comisión',
  INTERNAL: 'Movimiento interno',
  UNKNOWN: 'Movimiento',
};

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

function isGenericCounterpartyName(name) {
  if (!name) return true;
  const cleaned = String(name).trim();
  if (!cleaned) return true;
  const generic = new Set([
    ...Object.values(MP_TRANSACTION_TYPE_LABELS),
    ...Object.keys(MP_TRANSACTION_TYPE_LABELS),
    'MercadoPago',
    'Mercado Pago',
    'Pago',
    'Movimiento',
    'Movimiento Mercado Pago',
    'account_money',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'ticket',
    'atm',
  ].map((v) => String(v).toLowerCase()));
  return generic.has(cleaned.toLowerCase());
}

export function getCounterparty(transaccion) {
  const meta = getOrigenMetadata(transaccion?.origen);

  const metaName = meta.counterpartyName || meta.businessName || meta.itemTitle || null;
  if (metaName && !isGenericCounterpartyName(metaName)) {
    return {
      name: metaName,
      label:
        meta.counterpartyLabel ||
        (transaccion?.tipo === 'EGRESO' ? 'Pagaste a' : 'Recibiste de'),
      role: meta.counterpartyRole || null,
      email: meta.counterpartyEmail || null,
    };
  }

  // Fallback: inferir desde descripción legacy (sin usar "Pago aprobado" como negocio)
  const formatted = formatMpTransactionDescription(transaccion?.descripcion, transaccion?.origen);
  const cleaned = (formatted || '').replace(/^MercadoPago\s*[-–—]\s*/i, '').trim();
  if (!cleaned) return null;

  const methodOnly = /^(credit_card|debit_card|account_money|bank_transfer|ticket|atm)\b/i;
  const candidate = cleaned.split(' · ')[0].split(' (Ref:')[0].trim();
  if (!candidate || methodOnly.test(candidate) || isGenericCounterpartyName(candidate)) {
    return null;
  }

  return {
    name: candidate,
    label: transaccion?.tipo === 'EGRESO' ? 'Pagaste a' : 'Recibiste de',
    role: null,
    email: null,
  };
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

  if (includeDate && transaccion?.fecha) {
    const date = new Date(transaccion.fecha);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      );
    }
  }

  if (isMercadoPagoOrigen(origen)) {
    if (origen.tipo === 'MERCADOPAGO_MOVIMIENTO') {
      parts.push(meta.isInternal || meta.statsExclude ? 'Interno' : 'Wallet');
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
