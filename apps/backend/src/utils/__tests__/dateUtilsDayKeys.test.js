import {
  toISODateString,
  formatDateForAPI,
  parseAPIDate,
  setUserTimezone,
  getNormalizedToday,
} from '@shared/utils/dateUtils.js';

describe('dateUtils day keys', () => {
  beforeAll(() => {
    setUserTimezone('America/Santiago');
  });

  it('toISODateString keeps YYYY-MM-DD strings', () => {
    expect(toISODateString('2026-08-08')).toBe('2026-08-08');
  });

  it('toISODateString uses UTC date for UTC-midnight Mongo days', () => {
    const utcMidnight = new Date('2026-08-08T00:00:00.000Z');
    expect(toISODateString(utcMidnight)).toBe('2026-08-08');
  });

  it('toISODateString does not shift local midnight via toISOString', () => {
    // Local midnight can be previous UTC day in Chile; must still be calendar local day
    const localMidnight = new Date(2026, 7, 8, 0, 0, 0, 0); // Aug 8 local
    expect(toISODateString(localMidnight)).toBe('2026-08-08');
  });

  it('toISODateString uses date part of ISO strings', () => {
    expect(toISODateString('2026-08-08T00:00:00.000Z')).toBe('2026-08-08');
  });

  it('parseAPIDate + toISODateString round-trip for rutina fecha', () => {
    const parsed = parseAPIDate('2026-08-08T00:00:00.000Z');
    expect(toISODateString(parsed)).toBe('2026-08-08');
    expect(formatDateForAPI(parsed)).toBe('2026-08-08');
  });

  it('getNormalizedToday returns a Date at local midnight of prefs day', () => {
    const today = getNormalizedToday();
    expect(today.getHours()).toBe(0);
    expect(toISODateString(today)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
