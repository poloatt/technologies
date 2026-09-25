import { resolveDietHabitCaptions, defaultDietPlanVinculos } from '@attadia/shared/pulso/dietHabitLink.js';
import { resolveControlStatus } from '@attadia/shared/pulso/controlStatus.js';

describe('resolveDietHabitCaptions', () => {
  it('arma el texto de cocina y de compra sin tocar completitud', () => {
    const plan = {
      vinculos: {
        ...defaultDietPlanVinculos(),
        compras: [
          { canal: 'verduleria', section: 'nutricion', habitId: 'super' },
        ],
      },
    };
    const recetas = [{
      _id: 'r1',
      nombre: 'Ensalada',
      ingredientes: [{ nombre: 'lechuga', canal: 'verduleria' }],
    }];
    const menu = { slots: { CENA: { recetaId: 'r1', comido: true } } };
    const captions = resolveDietHabitCaptions({ plan, menu, recetas });
    expect(captions.nutricion.cocinar).toBe('Ensalada');
    expect(captions.nutricion.super).toBe('lechuga');
  });
});

describe('resolveControlStatus', () => {
  it('marca vencido si no hay estudio hecho y no lo apaga un turno pendiente', () => {
    const control = { controlId: 'sangre', intervaloDias: 365 };
    const status = resolveControlStatus(control, [{
      controlId: 'sangre',
      tipo: 'TURNO',
      estado: 'PENDIENTE',
      fecha: '2026-01-01',
    }]);
    expect(status.vencido).toBe(true);
    expect(status.pendiente).toBe(true);
  });

  it('queda al día dentro del plazo', () => {
    const control = { controlId: 'ojos', intervaloDias: 365 };
    const status = resolveControlStatus(control, [{
      controlId: 'ojos',
      tipo: 'REVISION',
      estado: 'HECHO',
      fecha: new Date().toISOString(),
    }], new Date());
    expect(status.vencido).toBe(false);
  });
});
