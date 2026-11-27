import { tramosSinRetiros } from '../mercadoPagoUtils.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso) => new Date(iso);

// Caso real: salidas a CBU el 31/3 y el 2/6, y en el medio solo entraron Debin.
const huecoAbrMay = [
  { fecha: at('2026-03-20T18:19:00Z'), tipo: 'EGRESO' },
  { fecha: at('2026-03-31T19:30:00Z'), tipo: 'EGRESO' },
  { fecha: at('2026-04-07T01:41:00Z'), tipo: 'INGRESO' },
  { fecha: at('2026-04-22T16:29:00Z'), tipo: 'INGRESO' },
  { fecha: at('2026-05-29T13:59:00Z'), tipo: 'INGRESO' },
  { fecha: at('2026-06-02T22:49:00Z'), tipo: 'EGRESO' },
  { fecha: at('2026-06-03T17:34:00Z'), tipo: 'EGRESO' },
];

describe('tramosSinRetiros', () => {
  it('detecta el hueco entre dos salidas a CBU con entradas en el medio', () => {
    const tramos = tramosSinRetiros(huecoAbrMay);
    expect(tramos.length).toBeGreaterThan(0);
    const begin = Math.min(...tramos.map((t) => Date.parse(t.beginDate)));
    const end = Math.max(...tramos.map((t) => Date.parse(t.endDate)));
    expect(new Date(begin).toISOString()).toBe('2026-03-31T19:30:00.000Z');
    expect(new Date(end).toISOString()).toBe('2026-06-02T22:49:00.000Z');
  });

  it('parte huecos largos en tramos de hasta 58 días, el más reciente primero', () => {
    const tramos = tramosSinRetiros(huecoAbrMay);
    expect(tramos).toHaveLength(2);
    for (const t of tramos) {
      expect(Date.parse(t.endDate) - Date.parse(t.beginDate)).toBeLessThanOrEqual(58 * DAY);
    }
    expect(Date.parse(tramos[0].beginDate)).toBeGreaterThan(Date.parse(tramos[1].beginDate));
    expect(tramos[0].mesLabel).toMatch(/–/);
  });

  it('omite los tramos ya revisados', () => {
    const [primero, segundo] = tramosSinRetiros(huecoAbrMay);
    const restantes = tramosSinRetiros(huecoAbrMay, { revisados: [primero] });
    expect(restantes).toEqual([segundo]);
    expect(tramosSinRetiros(huecoAbrMay, { revisados: [primero, segundo] })).toEqual([]);
  });

  it('no marca huecos cortos', () => {
    const movs = [
      { fecha: at('2026-03-01T00:00:00Z'), tipo: 'EGRESO' },
      { fecha: at('2026-03-10T00:00:00Z'), tipo: 'INGRESO' },
      { fecha: at('2026-04-10T00:00:00Z'), tipo: 'EGRESO' },
    ];
    expect(tramosSinRetiros(movs)).toEqual([]);
  });

  it('no marca huecos sin entradas: no hubo plata para transferir', () => {
    const movs = [
      { fecha: at('2026-01-01T00:00:00Z'), tipo: 'EGRESO' },
      { fecha: at('2026-05-01T00:00:00Z'), tipo: 'EGRESO' },
    ];
    expect(tramosSinRetiros(movs)).toEqual([]);
  });

  it('tolera listas vacías y fechas inválidas', () => {
    expect(tramosSinRetiros([])).toEqual([]);
    expect(tramosSinRetiros([{ fecha: 'no-fecha', tipo: 'EGRESO' }])).toEqual([]);
  });
});
