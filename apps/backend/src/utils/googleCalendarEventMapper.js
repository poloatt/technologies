/**
 * Google Calendar event → Tarea fields.
 * All-day date-only strings are logical calendar days — stored as UTC noon
 * so getDate() stays correct across server/client timezones (not server-local midnight).
 */

const DEFAULT_SKIP_EVENT_TYPES = new Set(['workingLocation', 'focusTime']);

function getSkipEventTypes() {
  const raw = process.env.GCAL_SKIP_EVENT_TYPES;
  if (!raw) return DEFAULT_SKIP_EVENT_TYPES;
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function shouldImportEventType(eventType) {
  const skip = getSkipEventTypes();
  const type = eventType || 'default';
  if (skip.has(type)) return false;
  return true;
}

/**
 * Parse YYYY-MM-DD as a timezone-safe calendar day (UTC noon).
 * Avoids server-local midnight shifting the day when serialized/read elsewhere.
 */
export function parseLocalDateOnly(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function endOfDateOnlyDay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function mapGoogleEventDates(event) {
  const start = event?.start || {};
  const end = event?.end || {};

  if (start.dateTime) {
    const fechaInicio = new Date(start.dateTime);
    const fechaFin = end.dateTime ? new Date(end.dateTime) : new Date(start.dateTime);
    if (Number.isNaN(fechaInicio.getTime())) return null;
    return {
      allDay: false,
      fechaInicio,
      fechaFin: Number.isNaN(fechaFin.getTime()) ? fechaInicio : fechaFin,
    };
  }

  if (start.date) {
    const fechaInicio = parseLocalDateOnly(start.date);
    if (!fechaInicio) return null;

    let fechaFin;
    if (end.date && /^\d{4}-\d{2}-\d{2}$/.test(end.date)) {
      // Google all-day end is exclusive → last included instant is prior day 23:59:59.999Z
      const [y, m, d] = end.date.split('-').map(Number);
      const endExclusiveMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      if (!Number.isNaN(endExclusiveMidnight.getTime())) {
        fechaFin = new Date(endExclusiveMidnight.getTime() - 1);
      }
    }
    if (!fechaFin) {
      fechaFin = endOfDateOnlyDay(start.date) || fechaInicio;
    }

    return { allDay: true, fechaInicio, fechaFin };
  }

  return null;
}

/**
 * Resuelve color/categoría de un evento Google:
 * 1) Labels con nombre (eventLabelId → labelProperties.eventLabels)
 * 2) colorId legacy (palette fija / colors.get)
 * 3) color del calendario (Predeterminada)
 */
export function resolveGoogleEventAppearance(event, {
  labelsById = {},
  eventColorsById = {},
  calendarBackgroundColor = null,
} = {}) {
  const eventLabelId = (event?.eventLabelId && String(event.eventLabelId).trim()) || null;
  if (eventLabelId) {
    const label = labelsById[eventLabelId];
    if (label?.backgroundColor) {
      return {
        eventLabelId,
        eventLabelName: (label.name && String(label.name).trim()) || null,
        colorId: null,
        backgroundColor: normalizeHexColor(label.backgroundColor),
      };
    }
  }

  const colorId = event?.colorId != null ? String(event.colorId) : null;
  if (colorId) {
    const swatch = eventColorsById[colorId] ?? FALLBACK_EVENT_COLORS[colorId];
    const bg = typeof swatch === 'string'
      ? swatch
      : (swatch?.background || swatch?.backgroundColor || null);
    if (bg) {
      return {
        eventLabelId: null,
        eventLabelName: null,
        colorId,
        backgroundColor: normalizeHexColor(bg),
      };
    }
  }

  return {
    eventLabelId: null,
    eventLabelName: null,
    colorId: null,
    backgroundColor: normalizeHexColor(calendarBackgroundColor),
  };
}

function normalizeHexColor(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/** Palette clásica de event colorId (colors.get → event). */
export const FALLBACK_EVENT_COLORS = {
  1: '#a4bdfc',
  2: '#7ae7bf',
  3: '#dbadff',
  4: '#ff887c',
  5: '#fbd75b',
  6: '#ffb878',
  7: '#46d6db',
  8: '#e1e1e1',
  9: '#5484ed',
  10: '#51b749',
  11: '#dc2127',
};

export function mapGoogleEventToTareaFields(event, calendarId, appearanceOptions = {}) {
  if (!event?.id) return null;
  if (event.status === 'cancelled') return { cancelled: true, googleEventId: event.id, calendarId };
  if (!shouldImportEventType(event.eventType)) return null;

  const dates = mapGoogleEventDates(event);
  if (!dates) return null;

  const appearance = resolveGoogleEventAppearance(event, appearanceOptions);

  return {
    titulo: (event.summary || '').trim() || '(Sin título)',
    descripcion: event.description || '',
    tipo: 'EVENTO',
    fechaInicio: dates.fechaInicio,
    fechaFin: dates.fechaFin,
    fechaVencimiento: dates.fechaFin,
    estado: 'PENDIENTE',
    completada: false,
    googleCalendarSync: {
      googleEventId: event.id,
      googleCalendarId: calendarId,
      etag: event.etag || null,
      htmlLink: event.htmlLink || null,
      allDay: Boolean(dates.allDay),
      status: event.status || 'confirmed',
      eventType: event.eventType || 'default',
      eventLabelId: appearance.eventLabelId,
      eventLabelName: appearance.eventLabelName,
      colorId: appearance.colorId,
      backgroundColor: appearance.backgroundColor,
      lastSyncDate: new Date(),
    },
  };
}

export function isGoogleCalendarImportedEvent(doc) {
  return String(doc?.tipo || '').toUpperCase() === 'EVENTO'
    && Boolean(doc?.googleCalendarSync?.googleEventId);
}
