import {
  mapGoogleEventDates,
  mapGoogleEventToTareaFields,
  parseLocalDateOnly,
  shouldImportEventType,
  isGoogleCalendarImportedEvent,
} from '../googleCalendarEventMapper.js';

describe('googleCalendarEventMapper', () => {
  describe('parseLocalDateOnly', () => {
    it('parses YYYY-MM-DD as UTC noon (timezone-safe day)', () => {
      const d = parseLocalDateOnly('2026-06-21');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(5);
      expect(d.getUTCDate()).toBe(21);
      expect(d.getUTCHours()).toBe(12);
    });
  });

  describe('mapGoogleEventDates', () => {
    it('maps timed events with dateTime start/end', () => {
      const result = mapGoogleEventDates({
        start: { dateTime: '2026-06-21T13:00:00-03:00' },
        end: { dateTime: '2026-06-21T14:50:00-03:00' },
      });
      expect(result.allDay).toBe(false);
      expect(result.fechaInicio).toEqual(new Date('2026-06-21T13:00:00-03:00'));
      expect(result.fechaFin).toEqual(new Date('2026-06-21T14:50:00-03:00'));
    });

    it('maps all-day events with exclusive end date', () => {
      const result = mapGoogleEventDates({
        start: { date: '2026-06-21' },
        end: { date: '2026-06-22' },
      });
      expect(result.allDay).toBe(true);
      expect(result.fechaInicio.getUTCDate()).toBe(21);
      expect(result.fechaInicio.getUTCHours()).toBe(12);
      expect(result.fechaFin.getUTCDate()).toBe(21);
      expect(result.fechaFin.getUTCHours()).toBe(23);
      expect(result.fechaFin.getUTCMinutes()).toBe(59);
    });
  });

  describe('shouldImportEventType', () => {
    it('skips workingLocation and focusTime by default', () => {
      expect(shouldImportEventType('workingLocation')).toBe(false);
      expect(shouldImportEventType('focusTime')).toBe(false);
    });

    it('imports default and birthday events', () => {
      expect(shouldImportEventType('default')).toBe(true);
      expect(shouldImportEventType('birthday')).toBe(true);
      expect(shouldImportEventType(undefined)).toBe(true);
    });
  });

  describe('mapGoogleEventToTareaFields', () => {
    it('maps a timed calendar event to EVENTO fields', () => {
      const mapped = mapGoogleEventToTareaFields({
        id: 'evt1',
        summary: 'IPC - Aula 16',
        description: 'Clase',
        status: 'confirmed',
        etag: '"abc"',
        htmlLink: 'https://calendar.google.com/event?eid=evt1',
        start: { dateTime: '2026-06-22T13:00:00-03:00' },
        end: { dateTime: '2026-06-22T14:50:00-03:00' },
        eventType: 'default',
      }, 'primary');

      expect(mapped.tipo).toBe('EVENTO');
      expect(mapped.titulo).toBe('IPC - Aula 16');
      expect(mapped.googleCalendarSync.googleEventId).toBe('evt1');
      expect(mapped.googleCalendarSync.googleCalendarId).toBe('primary');
      expect(mapped.fechaInicio).toEqual(new Date('2026-06-22T13:00:00-03:00'));
    });

    it('returns cancelled marker for cancelled events', () => {
      const mapped = mapGoogleEventToTareaFields({
        id: 'evt-cancel',
        status: 'cancelled',
      }, 'primary');
      expect(mapped.cancelled).toBe(true);
      expect(mapped.googleEventId).toBe('evt-cancel');
    });

    it('returns null for skipped event types', () => {
      const mapped = mapGoogleEventToTareaFields({
        id: 'evt-wl',
        summary: 'Office',
        eventType: 'workingLocation',
        start: { date: '2026-06-21' },
        end: { date: '2026-06-22' },
      }, 'primary');
      expect(mapped).toBeNull();
    });
  });

  describe('isGoogleCalendarImportedEvent', () => {
    it('detects imported calendar events', () => {
      expect(isGoogleCalendarImportedEvent({
        tipo: 'EVENTO',
        googleCalendarSync: { googleEventId: 'x' },
      })).toBe(true);
      expect(isGoogleCalendarImportedEvent({
        tipo: 'EVENTO',
      })).toBe(false);
      expect(isGoogleCalendarImportedEvent({
        tipo: 'TAREA',
        googleCalendarSync: { googleEventId: 'x' },
      })).toBe(false);
    });
  });
});
