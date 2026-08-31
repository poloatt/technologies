import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HABIT_ICON_DONE_TONE,
  isHabitIconDeferredPendingSlot,
  isHabitIconPlainPendingSlot,
  resolveHabitBadgeChrome,
  resolveHabitIconPresentation,
} from '../../../../shared/habits/presentation/habitIconPresentation.js';

describe('resolveHabitIconPresentation', () => {
  it('pendiente activo: outline + borde circular', () => {
    const p = resolveHabitIconPresentation({ isCompleted: false, carouselSlot: 'ahora' });
    assert.equal(p.outline, true);
    assert.equal(p.hideBorder, false);
    assert.equal(p.variant, 'activePending');
    assert.equal(p.doneTone, null);
  });

  it('sinHacer / franja anterior: outline plano', () => {
    const p = resolveHabitIconPresentation({ isCompleted: false, carouselSlot: 'sinHacer' });
    assert.equal(p.outline, true);
    assert.equal(p.hideBorder, true);
    assert.equal(p.variant, 'plainPending');
  });

  it('Luego: outline plano diferido (menos brillo)', () => {
    const p = resolveHabitIconPresentation({ isCompleted: false, carouselSlot: 'luego' });
    assert.equal(p.outline, true);
    assert.equal(p.hideBorder, true);
    assert.equal(p.variant, 'deferredPending');
  });

  it('deferredPending de lista', () => {
    const p = resolveHabitIconPresentation({ isCompleted: false, deferredPending: true });
    assert.equal(p.variant, 'deferredPending');
    assert.equal(p.hideBorder, true);
  });

  it('plainPending de lista (hideBorder): outline sin círculo', () => {
    const p = resolveHabitIconPresentation({ isCompleted: false, plainPending: true });
    assert.equal(p.outline, true);
    assert.equal(p.hideBorder, true);
    assert.equal(p.variant, 'plainPending');
  });

  it('hecho hoy: filled plano con tono today', () => {
    const p = resolveHabitIconPresentation({ isCompleted: true });
    assert.equal(p.outline, false);
    assert.equal(p.hideBorder, true);
    assert.equal(p.variant, 'completedToday');
    assert.equal(p.doneTone, HABIT_ICON_DONE_TONE.TODAY);
  });

  it('hecho antes (cuota): filled plano con tono before', () => {
    const p = resolveHabitIconPresentation({ doneTone: 'before' });
    assert.equal(p.outline, false);
    assert.equal(p.hideBorder, true);
    assert.equal(p.variant, 'completedBefore');
    assert.equal(p.doneTone, HABIT_ICON_DONE_TONE.BEFORE);
  });

  it('doneTone before gana aunque isCompleted sea false (cuota sin marca hoy)', () => {
    const p = resolveHabitIconPresentation({ isCompleted: false, doneTone: 'before' });
    assert.equal(p.variant, 'completedBefore');
    assert.equal(p.hideBorder, true);
  });

  it('opt-out filled pendiente (legacy)', () => {
    const p = resolveHabitIconPresentation({
      isCompleted: false,
      preferOutlineWhenPending: false,
    });
    assert.equal(p.outline, false);
    assert.equal(p.variant, 'activePending');
  });

  it('preview futuro: fuerza plainPending aunque el slot sea luego o activo', () => {
    const active = resolveHabitIconPresentation({
      isCompleted: false,
      carouselSlot: 'ahora',
      forcePlainPending: true,
    });
    assert.equal(active.variant, 'plainPending');
    assert.equal(active.hideBorder, true);
    assert.equal(active.outline, true);

    const deferred = resolveHabitIconPresentation({
      isCompleted: false,
      carouselSlot: 'luego',
      deferredPending: true,
      forcePlainPending: true,
    });
    assert.equal(deferred.variant, 'plainPending');
    assert.equal(deferred.hideBorder, true);
  });
});

describe('resolveHabitBadgeChrome', () => {
  it('alinea cuota/franja con la presentación del icono', () => {
    assert.equal(resolveHabitBadgeChrome({ variant: 'activePending' }).outline, true);
    assert.equal(resolveHabitBadgeChrome({ variant: 'deferredPending' }).opacity, 0.4);
    assert.equal(resolveHabitBadgeChrome({ variant: 'completedBefore' }).opacity, 0.45);
    assert.equal(resolveHabitBadgeChrome({ variant: 'completedToday' }).opacity, 1);
  });
});

describe('pending slot helpers', () => {
  it('distingue plain vs deferred', () => {
    assert.equal(isHabitIconPlainPendingSlot('sinHacer'), true);
    assert.equal(isHabitIconPlainPendingSlot('luego'), false);
    assert.equal(isHabitIconDeferredPendingSlot('luego'), true);
    assert.equal(isHabitIconDeferredPendingSlot('notToday'), true);
    assert.equal(isHabitIconDeferredPendingSlot('ahora'), false);
    assert.equal(isHabitIconDeferredPendingSlot(null, { isScheduled: false }), true);
  });
});
