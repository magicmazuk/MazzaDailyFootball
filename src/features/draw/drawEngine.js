// The draw ceremony reducer (spec §8.3-8.5). Pure and framework-free — the
// component owns real time (setTimeout) and only ever dispatches TICK when
// an animation step has finished; this file never reads a clock.
//
// Reveal order is fixed and derivable from a single counter (`landed`):
// bowl mode reveals BALLS 0..2n-1 in the order tie0-home, tie0-away,
// tie1-home, tie1-away, …; rollcall mode reveals TIES 0..n-1, both sides at
// once. Because reveals always happen in that order, `landed` (the count of
// units — balls or ties — that have finished landing) alone determines
// which sides are showing in the tie list and which clubs remain in the
// pool; no separate "current index" field is needed.
//
// Bowl phase machine: idle → tumbling(ball k) → revealed(ball k, held) →
// landed(ball k) → tumbling(ball k+1) → … The ball currently tumbling/
// revealed is always ball `landed` (the next one due), since `landed` only
// increments once that ball has fully landed.
// Rollcall phase machine: idle → drawing(tie k) → landed(tie k) → …

export const TIMINGS = { tumble: 1200, holdOpen: 1500, land: 450, rollcallGap: 1100 };

// Distinct clubs across a round's ties, by teamId — a replay pair (the same
// two clubs meeting twice in one round) contributes no new clubs, so it
// never pushes a round over the bowl/rollcall threshold on its own.
export function distinctClubCount(ties) {
  const ids = new Set();
  for (const t of ties ?? []) {
    if (t?.home?.teamId != null) ids.add(t.home.teamId);
    if (t?.away?.teamId != null) ids.add(t.away.teamId);
  }
  return ids.size;
}

export function drawMode(ties) {
  return distinctClubCount(ties) <= 16 ? 'bowl' : 'rollcall';
}

// One reveal unit per ball (bowl, two per tie) or per tie (rollcall, one
// per tie) — the length of the fixed reveal sequence.
function totalUnits(state) {
  return state.mode === 'bowl' ? state.ties.length * 2 : state.ties.length;
}

export function initDraw(ties, mode) {
  return { ties, mode, phase: 'idle', landed: 0 };
}

export function drawReducer(state, action) {
  switch (action.type) {
    case 'TAP': {
      if (state.phase !== 'idle' && state.phase !== 'landed') return state;
      return { ...state, phase: state.mode === 'bowl' ? 'tumbling' : 'drawing' };
    }
    case 'TICK': {
      if (state.mode === 'bowl') {
        if (state.phase === 'tumbling') return { ...state, phase: 'revealed' };
        if (state.phase === 'revealed') {
          const landed = state.landed + 1;
          return { ...state, landed, phase: landed >= totalUnits(state) ? 'complete' : 'landed' };
        }
        return state;
      }
      if (state.phase === 'drawing') {
        const landed = state.landed + 1;
        return { ...state, landed, phase: landed >= totalUnits(state) ? 'complete' : 'landed' };
      }
      return state;
    }
    case 'REVEAL_REST':
      return { ...state, phase: 'complete', landed: totalUnits(state) };
    case 'RESET':
      return initDraw(state.ties, state.mode);
    default:
      return state;
  }
}

// Per-tie landed status, in TIE order (not reveal order) — what the tie
// list renders: every tie gets a row, landed sides carry their real club,
// unlanded ones render an empty slot.
export function landedSides(state) {
  const { ties, mode, landed } = state;
  return ties.map((tie, i) => (mode === 'bowl'
    ? { tie, home: landed > i * 2, away: landed > i * 2 + 1 }
    : { tie, home: landed > i, away: landed > i }));
}

// Clubs still in the pool/roll call — a side leaves the moment it lands.
// Bowl: shrinks by one club per landed ball. Rollcall: shrinks by two
// (both sides of a tie) per landed tie.
export function remainingClubs(state) {
  const clubs = [];
  for (const { tie, home, away } of landedSides(state)) {
    if (!home && tie.home) clubs.push(tie.home);
    if (!away && tie.away) clubs.push(tie.away);
  }
  return clubs;
}

export function isComplete(state) {
  return state.phase === 'complete';
}
