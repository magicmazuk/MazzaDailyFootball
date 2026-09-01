import { expect, test } from 'vitest';
import { project, releaseIntent, releaseVelocity, rubberband, settleMs } from './sheetPhysics.js';

// ——— rubberband (Apple's constant 0.55): progressive resistance ———

test('rubberband resists progressively — 60px of pull shows ~30px against a 320px sheet', () => {
  expect(rubberband(60, 320)).toBeCloseTo(29.9, 1);
  expect(rubberband(0, 320)).toBe(0);
});

test('rubberband is sublinear — a huge pull still lands well under the dimension', () => {
  const far = rubberband(200, 320);
  expect(far).toBeGreaterThan(rubberband(60, 320));
  expect(far).toBeLessThan(100);
});

// ——— momentum projection (decel 0.99, the snappier Apple rate) ———

test('project throws the resting point forward from velocity in px/ms', () => {
  expect(project(0.625)).toBeCloseTo(61.875, 2);
  expect(project(0)).toBe(0);
  expect(project(-0.5)).toBeCloseTo(-49.5, 2);
});

// ——— release velocity from a position/time history ———

test('release velocity reads the recent window — 30px over 48ms is 0.625 px/ms', () => {
  const samples = [
    { y: 200, t: 0 }, { y: 210, t: 16 }, { y: 220, t: 32 }, { y: 230, t: 48 },
  ];
  expect(releaseVelocity(samples, 48)).toBeCloseTo(0.625, 3);
});

test('samples older than the 100ms window are ignored', () => {
  const samples = [
    { y: 0, t: 0 }, // stale — a pause happened after this
    { y: 200, t: 500 }, { y: 230, t: 548 },
  ];
  expect(releaseVelocity(samples, 548)).toBeCloseTo(0.625, 3);
});

test('upward motion reads negative; too little history or time reads zero', () => {
  expect(releaseVelocity([{ y: 300, t: 0 }, { y: 270, t: 48 }], 48)).toBeCloseTo(-0.625, 3);
  expect(releaseVelocity([{ y: 300, t: 0 }], 0)).toBe(0);
  // same-tick dispatches (jsdom) collapse dt to ~0 — velocity must not explode
  expect(releaseVelocity([{ y: 200, t: 0 }, { y: 340, t: 2 }], 2)).toBe(0);
});

// ——— settle duration: the animation inherits the finger's speed ———

test('settle duration is remaining distance over velocity, clamped 180–420ms', () => {
  expect(settleMs(120, 0.6)).toBe(200);
  expect(settleMs(120, 0)).toBe(400); // slow floor: v treated as 0.3
  expect(settleMs(400, 0.3)).toBe(420); // never a long crawl
  expect(settleMs(10, 2)).toBe(180); // never a hard cut
});

// ——— release intent: the projected point meets the 40px line ———

test('from the peek, a long slow drag down closes; a tiny one rests', () => {
  expect(releaseIntent({ absY: 120, velocity: 0, expanded: false, atTop: true })).toBe('close');
  expect(releaseIntent({ absY: 10, velocity: 0, expanded: false, atTop: true })).toBe('rest');
});

test('a 30px flick projects past the line and closes; a 30px drift springs back', () => {
  expect(releaseIntent({ absY: 30, velocity: 0.625, expanded: false, atTop: true })).toBe('close');
  expect(releaseIntent({ absY: 30, velocity: 0.05, expanded: false, atTop: true })).toBe('rest');
});

test('upward from the peek expands — by distance or by projection', () => {
  expect(releaseIntent({ absY: -120, velocity: 0, expanded: false, atTop: true })).toBe('expand');
  expect(releaseIntent({ absY: -30, velocity: -0.625, expanded: false, atTop: true })).toBe('expand');
});

test('expanded at the top, down collapses; scrolled away it rests — the old law stands', () => {
  expect(releaseIntent({ absY: 120, velocity: 0, expanded: true, atTop: true })).toBe('collapse');
  expect(releaseIntent({ absY: 120, velocity: 0, expanded: true, atTop: false })).toBe('rest');
});

test('a hard flick down while expanded closes outright; upward while expanded rests', () => {
  expect(releaseIntent({ absY: 60, velocity: 1.5, expanded: true, atTop: true })).toBe('close');
  expect(releaseIntent({ absY: 60, velocity: 1.5, expanded: true, atTop: false })).toBe('rest');
  expect(releaseIntent({ absY: -80, velocity: -0.4, expanded: true, atTop: true })).toBe('rest');
});
