import {
  mapGoogleEventDates,
  mapGoogleEventToTareaFields,
  parseLocalDateOnly,
  resolveGoogleEventAppearance,
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
    it('maps all-day calendar event with allDay flag persisted', () => {
      const mapped = mapGoogleEventToTareaFields({
        id: 'evt-allday',
        summary: 'Feriado',
        status: 'confirmed',
        start: { date: '2026-06-21' },
        end: { date: '2026-06-22' },
        eventType: 'default',
      }, 'primary');

      expect(mapped.tipo).toBe('EVENTO');
      expect(mapped.googleCalendarSync.allDay).toBe(true);
      expect(mapped.fechaInicio.getUTCHours()).toBe(12);
    });

    it('maps timed calendar event with allDay false', () => {
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

      expect(mapped.googleCalendarSync.allDay).toBe(false);
    });

    it('maps named event label (categoría Google) to color + name', () => {
      const labelId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const mapped = mapGoogleEventToTareaFields({
        id: 'evt-salud',
        summary: 'Gym',
        status: 'confirmed',
        start: { dateTime: '2026-06-22T09:00:00-03:00' },
        end: { dateTime: '2026-06-22T10:00:00-03:00' },
        eventLabelId: labelId,
        colorId: '5',
      }, 'primary', {
        labelsById: {
          [labelId]: { id: labelId, name: 'Salud', backgroundColor: '#8e24aa' },
        },
        eventColorsById: { 5: '#fbd75b' },
        calendarBackgroundColor: '#039be5',
      });

      expect(mapped.googleCalendarSync.eventLabelId).toBe(labelId);
      expect(mapped.googleCalendarSync.eventLabelName).toBe('Salud');
      expect(mapped.googleCalendarSync.backgroundColor).toBe('#8e24aa');
      expect(mapped.googleCalendarSync.colorId).toBeNull();
    });

    it('falls back to legacy colorId then calendar default', () => {
      const withColor = mapGoogleEventToTareaFields({
        id: 'evt-c',
        summary: 'X',
        status: 'confirmed',
        start: { dateTime: '2026-06-22T09:00:00Z' },
        end: { dateTime: '2026-06-22T09:30:00Z' },
        colorId: '11',
      }, 'primary', {
        eventColorsById: { 11: '#dc2127' },
        calendarBackgroundColor: '#039be5',
      });
      expect(withColor.googleCalendarSync.backgroundColor).toBe('#dc2127');
      expect(withColor.googleCalendarSync.colorId).toBe('11');

      const defaultOnly = mapGoogleEventToTareaFields({
        id: 'evt-d',
        summary: 'Y',
        status: 'confirmed',
        start: { dateTime: '2026-06-22T09:00:00Z' },
        end: { dateTime: '2026-06-22T09:30:00Z' },
      }, 'primary', {
        calendarBackgroundColor: '#039be5',
      });
      expect(defaultOnly.googleCalendarSync.backgroundColor).toBe('#039be5');
      expect(defaultOnly.googleCalendarSync.eventLabelName).toBeNull();
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

  describe('resolveGoogleEventAppearance', () => {
    it('prefers label over colorId', () => {
      const appearance = resolveGoogleEventAppearance(
        { eventLabelId: 'L1', colorId: '3' },
        {
          labelsById: { L1: { name: 'Tech', backgroundColor: '#f6bf26' } },
          eventColorsById: { 3: '#dbadff' },
        },
      );
      expect(appearance.eventLabelName).toBe('Tech');
      expect(appearance.backgroundColor).toBe('#f6bf26');
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
