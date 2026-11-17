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
});
