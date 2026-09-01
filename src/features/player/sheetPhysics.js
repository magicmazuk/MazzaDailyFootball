// The sheet's arithmetic (spec §13.50): rubberband, momentum projection,
// release velocity and intent — the apple-design numbers, pure and
// unit-tested on their own. The pointer wiring lives in PlayerSheet; no
// DOM in here.

// A gesture's vertical travel (px) — raw or PROJECTED — past which a
// release commits instead of springing back. The same 40px line the
// sheet has drawn since §13.16.
export const SWIPE_THRESHOLD = 40;

// Movement (px) before a pointer gesture locks a direction. Under this,
// a touch is still a tap and children keep their clicks.
export const DRAG_LOCK_PX = 10;

// Downward release velocity (px/ms) that closes an EXPANDED sheet
// outright — the hard flick that skips the peek.
export const HARD_FLICK = 1.2;

// vaul's release ease — the settle every drag hands off into.
export const SETTLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

// Progressive resistance past a boundary (Apple's constant 0.55): the
// further past, the less the sheet follows — display only, never fed
// back into the decision.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Where the finger's momentum would carry the sheet (exponential decay,
// deceleration 0.99 — Apple's snappier shipped rate). Velocity in px/ms.
export function project(velocity, decelerationRate = 0.99) {
  return (velocity * decelerationRate) / (1 - decelerationRate);
}

// Release velocity (px/ms, downward positive) from a short position/time
// history: only the last 100ms counts (a pause kills old momentum), and
// a window too thin to measure — one sample, or jsdom's same-tick
// dispatches — reads as zero so the distance rule decides instead.
export function releaseVelocity(samples, now) {
  const windowed = samples.filter(s => s.t >= now - 100);
  if (windowed.length < 2) return 0;
  const first = windowed[0];
  const last = windowed[windowed.length - 1];
  const dt = last.t - first.t;
  if (dt < 8) return 0;
  return (last.y - first.y) / dt;
}

// The settle inherits the finger's speed: remaining distance over
// release velocity, clamped so a still hand glides (never crawls) and a
// throw still reads as motion (never a hard cut).
export function settleMs(distance, velocity) {
  const v = Math.max(Math.abs(velocity), 0.3);
  return Math.min(420, Math.max(180, Math.round(Math.abs(distance) / v)));
}

// What a release means. absY is the sheet's absolute displacement at the
// finger's letting-go (raw travel plus any inherited mid-flight offset —
// never the rubberbanded display value); the PROJECTED point meets the
// threshold, so a flick commits from a short travel and a drift does not.
export function releaseIntent({ absY, velocity, expanded, atTop }) {
  if (expanded) {
    if (!atTop) return 'rest';
    if (velocity >= HARD_FLICK) return 'close';
    if (absY + project(velocity) >= SWIPE_THRESHOLD) return 'collapse';
    return 'rest';
  }
  const projected = absY + project(velocity);
  if (projected >= SWIPE_THRESHOLD) return 'close';
  if (projected <= -SWIPE_THRESHOLD) return 'expand';
  return 'rest';
}
