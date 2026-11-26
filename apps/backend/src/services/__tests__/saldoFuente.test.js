import { formatSaldoFuente, formatSaldosCorte } from '../../../../shared/utils/saldoFuente.js';

// 26 nov 2026, 12:00 en Argentina (UTC-3).
const NOW = new Date('2026-11-26T15:00:00Z');

describe('formatSaldoFuente', () => {
  it('muestra "MP · hoy HH:mm" para una lectura de hoy', () => {
    expect(formatSaldoFuente('mercadopago', '2026-11-26T14:02:00Z', '2026-12-31', NOW))
      .toBe('MP · hoy 11:02');
  });

  it('muestra día y hora para una lectura de otro día', () => {
    expect(formatSaldoFuente('mercadopago', '2026-11-25T21:40:00Z', '2026-11-26', NOW))
      .toBe('MP · 25 nov 18:40');
  });

  it('usa el día argentino aunque en UTC ya sea el día siguiente', () => {
    expect(formatSaldoFuente('mercadopago', '2026-11-26T02:30:00Z', '2026-11-26', NOW))
      .toBe('MP · 25 nov 23:30');
  });

  it('marca el ledger como estimado al cierre del período', () => {
    expect(formatSaldoFuente('ledger', null, '2026-09-30', NOW)).toBe('Estimado al 30 sep');
  });

  it('cae a estimado si la fuente MP no trae fecha válida', () => {
    expect(formatSaldoFuente('mercadopago', 'no-es-fecha', '2026-09-30', NOW)).toBe('Estimado al 30 sep');
    expect(formatSaldoFuente('mercadopago', null, null, NOW)).toBe('Estimado');
  });
});

describe('formatSaldosCorte', () => {
  it('dice "Saldos hoy" cuando el período llega a hoy o después', () => {
    expect(formatSaldosCorte('2026-11-26', NOW)).toBe('Saldos hoy');
    expect(formatSaldosCorte('2026-12-31', NOW)).toBe('Saldos hoy');
    expect(formatSaldosCorte(null, NOW)).toBe('Saldos hoy');
  });

  it('muestra la fecha de corte en períodos pasados', () => {
    expect(formatSaldosCorte('2026-09-30', NOW)).toBe('Saldos al 30 sep');
  });
});
