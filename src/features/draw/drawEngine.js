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
// Opponents phase machine (spec §13.15): idle → tumbling(fixture k) →
// revealed(fixture k, held) → landed(fixture k) → … — the same per-unit
// tumble/reveal/land flow as bowl, but one reveal unit per FIXTURE rather
// than per ball (only the opponent's side is ever revealed; the subject
// club's own side never tumbles).

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

// One reveal unit per ball (bowl, two per tie), per tie (rollcall, one per
// tie), or per fixture (opponents, one per tie — only the opponent's side
// lands) — the length of the fixed reveal sequence.
function totalUnits(state) {
  return state.mode === 'bowl' ? state.ties.length * 2 : state.ties.length;
}

// `subjectTeamId` (opponents mode only) identifies the followed club whose
// own side never reveals — every unit reveals the fixture's OTHER side.
// Ignored (and left undefined) for bowl/rollcall.
export function initDraw(ties, mode, { subjectTeamId } = {}) {
  return { ties, mode, phase: 'idle', landed: 0, subjectTeamId };
}

export function drawReducer(state, action) {
  switch (action.type) {
    case 'TAP': {
      if (state.phase !== 'idle' && state.phase !== 'landed') return state;
      return { ...state, phase: state.mode === 'rollcall' ? 'drawing' : 'tumbling' };
    }
    case 'TICK': {
      if (state.mode === 'bowl' || state.mode === 'opponents') {
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
      return initDraw(state.ties, state.mode, { subjectTeamId: state.subjectTeamId });
    default:
      return state;
  }
}

// Per-tie landed status, in TIE order (not reveal order) — what the tie
// list renders: every tie gets a row, landed sides carry their real club,
// unlanded ones render an empty slot.
//
// Opponents mode (spec §13.15) is club-centric rather than tie-centric: the
// subject club's own side is never a reveal target, so each row instead
// carries the fixture's opponent side directly, plus its venue ('H' if the
// subject played at home, 'A' otherwise) and kickoff — everything the
// ceremony's landed list ("v {Opponent} (H|A)") needs. The subject's own
// side is never placed on a row, in fixtures order (already kickoff order
// per the input contract), so it can never surface via landedSides.
export function landedSides(state) {
  const { ties, mode, landed, subjectTeamId } = state;
  if (mode === 'opponents') {
    return ties.map((tie, i) => {
      const venue = tie.home?.teamId === subjectTeamId ? 'H' : 'A';
      const opponent = venue === 'H' ? tie.away : tie.home;
      return { landed: landed > i, opponent, venue, kickoff: tie.kickoff };
    });
  }
  return ties.map((tie, i) => (mode === 'bowl'
    ? { tie, home: landed > i * 2, away: landed > i * 2 + 1 }
    : { tie, home: landed > i, away: landed > i }));
}

// Clubs still in the pool/roll call — a side leaves the moment it lands.
// Bowl: shrinks by one club per landed ball. Rollcall: shrinks by two
// (both sides of a tie) per landed tie. Opponents: shrinks by one opponent
// per landed fixture — the subject club is never a candidate, so it can
// never appear here either.
export function remainingClubs(state) {
  if (state.mode === 'opponents') {
    return landedSides(state).filter(row => !row.landed).map(row => row.opponent);
  }
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

// djb2 string hash → an unsigned 32-bit seed for mulberry32 below. Not
// cryptographic — just a cheap, deterministic way to turn an arbitrary
// seed string (e.g. `${compId}:${round}`) into a PRNG seed.
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0; // hash*33 + c
  }
  return hash >>> 0;
}

// mulberry32: small, fast, deterministic PRNG seeded from a 32-bit
// integer — same seed always produces the same sequence. Not
// cryptographic; good enough for a cosmetic display shuffle.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic Fisher-Yates shuffle, driven by mulberry32 seeded from a
// djb2 hash of `seedString` — the same (items, seedString) pair always
// produces the same order, and a different seed reorders it. Repo rule:
// no Math.random anywhere (determinism; a draw replay must look identical
// across visits/viewers). Pure: returns a new array, never mutates
// `items`. Presentation-only tool — callers decide what it's shuffling
// (e.g. the bowl pool's display order); it has no opinion on reveal order,
// which stays governed by the reducer's `landed` counter.
export function seededShuffle(items, seedString) {
  const result = items.slice();
  const rand = mulberry32(djb2(String(seedString)));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
