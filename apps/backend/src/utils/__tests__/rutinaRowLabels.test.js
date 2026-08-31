import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveRutinaScheduleLegend,
  resolveRutinaStackScheduleLegend,
} from '../../../../shared/habits/utils/rutinaRowLabels.js';

describe('resolveRutinaScheduleLegend', () => {
  it('diario en franja mañana → Cada mañana', () => {
    assert.equal(
      resolveRutinaScheduleLegend({
        config: { tipo: 'DIARIO', horarios: ['MAÑANA', 'NOCHE'] },
        franjaKey: 'MAÑANA',
      }),
      'Cada mañana',
    );
  });

  it('diario en franja noche → Cada noche', () => {
    assert.equal(
      resolveRutinaScheduleLegend({
        config: { tipo: 'DIARIO', horarios: ['MAÑANA', 'NOCHE'] },
        franjaKey: 'NOCHE',
      }),
      'Cada noche',
    );
  });

  it('semanal prioriza cadencia sobre franja', () => {
    assert.equal(
      resolveRutinaScheduleLegend({
        config: { tipo: 'SEMANAL', frecuencia: 1 },
        franjaKey: 'MAÑANA',
      }),
      'Semanal',
    );
  });

  it('mensual con cuota muestra progreso', () => {
    assert.equal(
      resolveRutinaScheduleLegend({
        config: { tipo: 'MENSUAL', frecuencia: 3 },
        isCompleted: false,
        rutina: { fecha: '2026-08-31' },
        section: 'salud',
        itemId: 'gym',
      }),
      'Mensual · 0/3',
    );
  });
});

describe('resolveRutinaStackScheduleLegend', () => {
  it('usa franja del bloque cuando todos los hábitos son diarios', () => {
    const legend = resolveRutinaStackScheduleLegend([
      {
        itemId: 'a',
        config: { tipo: 'DIARIO', horarios: ['MAÑANA'] },
        franjaKey: 'MAÑANA',
      },
      {
        itemId: 'b',
        config: { tipo: 'DIARIO', horarios: ['MAÑANA'] },
        franjaKey: 'MAÑANA',
      },
    ]);
    assert.equal(legend, 'Cada mañana');
  });

  it('prioriza cadencia semanal si algún hábito del stack no es diario', () => {
    const legend = resolveRutinaStackScheduleLegend([
      {
        itemId: 'a',
        config: { tipo: 'DIARIO', horarios: ['MAÑANA'] },
        franjaKey: 'MAÑANA',
      },
      {
        itemId: 'b',
        config: { tipo: 'SEMANAL', frecuencia: 1 },
        franjaKey: 'MAÑANA',
      },
    ]);
    assert.equal(legend, 'Semanal');
  });
});
