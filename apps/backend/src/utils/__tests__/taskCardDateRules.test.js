import {
  formatTaskCardSchedule,
  shouldShowEndDateOnCard,
} from '../../../../shared/utils/taskCardDateRules.js';

const fixedNow = new Date(2026, 5, 21, 10, 0, 0); // 21 jun 2026, sábado

describe('formatTaskCardSchedule', () => {
  test('same instant start and end shows once', () => {
    const instant = new Date(2026, 5, 21, 14, 30, 0);
    const label = formatTaskCardSchedule(
      { fechaInicio: instant, fechaFin: instant },
      { now: fixedNow, uppercase: false },
    );
    expect(label).toMatch(/21 jun/i);
    expect(label).toMatch(/14:30/);
    expect(label).not.toMatch(/–/);
  });

  test('same calendar day with different times uses one date line', () => {
    const label = formatTaskCardSchedule(
      {
        fechaInicio: new Date(2026, 5, 21, 14, 30, 0),
        fechaFin: new Date(2026, 5, 21, 15, 36, 0),
      },
      { now: fixedNow, uppercase: false },
    );
    expect(label).toMatch(/21 jun/i);
    expect(label).toMatch(/14:30 – 15:36/);
    expect((label.match(/21 jun/gi) || []).length).toBe(1);
  });

  test('different days shows start and end', () => {
    const label = formatTaskCardSchedule(
      {
        fechaInicio: new Date(2026, 5, 20, 10, 0, 0),
        fechaFin: new Date(2026, 5, 22, 18, 0, 0),
      },
      { now: fixedNow, uppercase: false },
    );
    expect(label).toMatch(/20/i);
    expect(label).toMatch(/22/i);
    expect(label).toContain('–');
  });

  test('hides end date when it falls on today but keeps same-day time range', () => {
    const today = new Date(2026, 5, 21, 14, 30, 0);
    const label = formatTaskCardSchedule(
      {
        fechaInicio: today,
        fechaFin: new Date(2026, 5, 21, 15, 36, 0),
      },
      { now: fixedNow, uppercase: false },
    );
    expect(label).toBe('14:30 – 15:36');
    expect(label).not.toMatch(/jun/i);
  });

  test('returns empty when only due is today', () => {
    const label = formatTaskCardSchedule(
      { fechaVencimiento: new Date(2026, 5, 21, 12, 0, 0) },
      { now: fixedNow, uppercase: false },
    );
    expect(label).toBe('');
  });

  test('shows due when not today', () => {
    const label = formatTaskCardSchedule(
      { fechaVencimiento: new Date(2026, 5, 25, 12, 0, 0) },
      { now: fixedNow, uppercase: false },
    );
    expect(label).toMatch(/25/i);
  });
});

describe('shouldShowEndDateOnCard', () => {
  test('returns false for today', () => {
    expect(shouldShowEndDateOnCard(new Date(2026, 5, 21, 18, 0, 0), fixedNow)).toBe(false);
  });

  test('returns true for other days', () => {
    expect(shouldShowEndDateOnCard(new Date(2026, 5, 22, 18, 0, 0), fixedNow)).toBe(true);
  });
});
