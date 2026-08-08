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

export function mapGoogleEventToTareaFields(event, calendarId) {
  if (!event?.id) return null;
  if (event.status === 'cancelled') return { cancelled: true, googleEventId: event.id, calendarId };
  if (!shouldImportEventType(event.eventType)) return null;

  const dates = mapGoogleEventDates(event);
  if (!dates) return null;

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
      status: event.status || 'confirmed',
      eventType: event.eventType || 'default',
      lastSyncDate: new Date(),
    },
  };
}

export function isGoogleCalendarImportedEvent(doc) {
  return String(doc?.tipo || '').toUpperCase() === 'EVENTO'
    && Boolean(doc?.googleCalendarSync?.googleEventId);
}
