import googleCalendarService from '../googleCalendarService.js';

describe('googleCalendarService primary id helpers', () => {
  test('normalizeSelectedCalendarIds maps primary to real id and dedupes', () => {
    const real = 'user@example.com';
    expect(googleCalendarService.normalizeSelectedCalendarIds(['primary'], real)).toEqual([real]);
    expect(googleCalendarService.normalizeSelectedCalendarIds(['primary', real], real)).toEqual([real]);
    expect(googleCalendarService.normalizeSelectedCalendarIds(['work@ex.com', 'primary'], real)).toEqual([
      'work@ex.com',
      real,
    ]);
    expect(googleCalendarService.normalizeSelectedCalendarIds([], real)).toEqual([real]);
  });

  test('calendarIdLookupKeys includes legacy primary alias for primary calendar', () => {
    const real = 'user@example.com';
    expect(googleCalendarService.calendarIdLookupKeys(real, real).sort()).toEqual(
      ['primary', real].sort(),
    );
    expect(googleCalendarService.calendarIdLookupKeys('other@ex.com', real)).toEqual(['other@ex.com']);
  });

  test('buildInWindowOrphanFilter scopes to calendar, window and unseen ids', () => {
    const from = new Date('2026-05-01T00:00:00.000Z');
    const to = new Date('2026-08-01T23:59:59.999Z');
    const filter = googleCalendarService.buildInWindowOrphanFilter({
      userId: 'u1',
      lookupKeys: ['user@example.com', 'primary'],
      seenEventIds: new Set(['ev-1', 'ev-2']),
      from,
      to,
    });
    expect(filter.usuario).toBe('u1');
    expect(filter.tipo).toBe('EVENTO');
    expect(filter['googleCalendarSync.googleCalendarId']).toEqual({
      $in: ['user@example.com', 'primary'],
    });
    expect(filter['googleCalendarSync.googleEventId'].$nin).toEqual(['ev-1', 'ev-2']);
    expect(filter.fechaInicio).toEqual({ $lte: to });
  });
});
