// Draw detection (spec §8.1, §13.14). Pure derivation over the standard
// Fixture shape and the persisted seenTies map — no UI, no fetching. A
// "draw" is a cup round whose ties are all still scheduled and all unseen:
// the feed has published pairings the app hasn't shown yet.
import { prettifyRound } from './round.js';
import { fallbackRoundLabel } from './field.js';

export const tieId = (compId, fixtureId) => `${compId}:${fixtureId}`;

// Minimal name normalization for dedupePairings' teamId-less fallback below
// — lowercased, non-alphanumerics stripped. Not the alias-aware cross-feed
// norm() in data/mergeCup.js (that reconciles ESPN vs BBC spellings of the
// same club); this only needs two fixtures from the SAME feed, describing
// the SAME pairing, to compare equal.
const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// A side's identity for pairing purposes: its teamId, or (rare — a side
// with no id yet) its normalized name.
const pairSideKey = side => (side?.teamId != null ? String(side.teamId) : `n:${norm(side?.name)}`);

// A fixture's pairing key: the two sides' identities, order-independent
// (sorted) so a reversed-venue return leg still matches its first leg.
// Scoped by round too, so two different rounds never collide even in the
// pathological case of the same two clubs meeting again later.
const pairKey = f => `${f?.round}::${[pairSideKey(f?.home), pairSideKey(f?.away)].sort().join('|')}`;

// A draw ceremony draws PAIRINGS, not legs — but a two-legged round (or a
// qualifying round with a return fixture) publishes one FIXTURE per leg.
// Collapse fixtures sharing an unordered team pair within the same round
// into ONE representative: the earliest kickoff, i.e. the first leg — its
// home/away sides are the pairing's true first-leg (original draw) venue.
// Result is ordered by that representative kickoff, stably (ties at the
// same kickoff keep their first-encountered relative order).
//
// A no-op for single-leg rounds: every fixture is already its own distinct
// pairing. This includes Scottish Cup replays — a replay shares its pairing
// with the original tie by design (a replay IS a second decisive meeting
// for the SAME drawn pairing), so collapsing it down to the first meeting
// is correct here: the draw ceremony only ever drew the pairing once.
export function dedupePairings(fixtures) {
  const reps = new Map(); // pairKey -> earliest-kickoff fixture seen so far
  for (const f of fixtures ?? []) {
    const key = pairKey(f);
    const cur = reps.get(key);
    if (!cur || new Date(f.kickoff).getTime() < new Date(cur.kickoff).getTime()) reps.set(key, f);
  }
  return [...reps.values()].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
  );
}

// Every one of a round's fixtures' tieIds — BOTH legs of a two-legged round
// — for marking a ceremony's round fully seen. Unlike dedupePairings (which
// collapses to one representative per pairing for display/reveal), seen-
// marking must cover every published fixture so unrevealedDraws' "every
// fixture unseen" detection and Today's per-fixture hiding never see a
// partially-seen round (one leg marked, the other not) once a ceremony
// completes.
export function roundTieIds(compId, fixtures) {
  return (fixtures ?? []).map(f => tieId(compId, f.id));
}

// A draw ceremony reveals one round's knockout pairings. Group-stage and
// league-phase rounds publish their whole phase's fixture list at once —
// there is no pairing to reveal, so the ceremony is meaningless for them
// even when every fixture in the phase happens to be scheduled and unseen.
export const PHASE_ROUNDS = new Set(['group-stage', 'league-phase']);

// [{ comp, round, roundLabel, ties }] for every cup round that qualifies as
// an unrevealed draw. A round qualifies when every one of its fixtures is
// still 'scheduled' (no ball has been kicked), every fixture's tieId is
// absent from seenTies (nothing in it has been shown before), the round has
// a displayable label, and it holds at least two ties — a single published
// fixture is broadcast scheduling (a bye, a rearranged date), not a draw.
export function unrevealedDraws(fixturesByComp, seenTies) {
  const draws = [];
  for (const { comp, fixtures } of fixturesByComp ?? []) {
    if (comp?.type !== 'cup') continue;

    const byRound = new Map();
    for (const f of fixtures ?? []) {
      if (f?.round == null) continue;
      if (!byRound.has(f.round)) byRound.set(f.round, []);
      byRound.get(f.round).push(f);
    }

    for (const [round, roundFixtures] of byRound) {
      if (PHASE_ROUNDS.has(round)) continue;
      // Gate on distinct PAIRINGS, not raw legs (backlog, two-leg hotfix
      // review): a single-pairing two-legged round publishes 2 fixtures for
      // ONE tie — dedupePairings collapses those to 1, correctly failing
      // this gate (a draw ceremony draws pairings, and one drawn pairing is
      // scheduling, not a draw, same as the single-tie single-leg case).
      if (dedupePairings(roundFixtures).length < 2) continue;
      if (!roundFixtures.every(f => f.status === 'scheduled')) continue;
      if (!roundFixtures.every(f => !seenTies?.[tieId(comp.id, f.id)])) continue;
      const roundLabel = prettifyRound(round) ?? fallbackRoundLabel(round);
      if (!roundLabel) continue;

      const ties = [...roundFixtures].sort(
        (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
      );
      // ties stays the FULL fixture list (both legs of a two-legged round)
      // — hiding (Today) and seen-marking (DrawScreen) depend on every
      // fixture being present. tieCount is the deduped pairing count, for
      // display ("N ties unrevealed") without leaking leg-doubled numbers.
      draws.push({ comp, round, roundLabel, ties, tieCount: dedupePairings(roundFixtures).length });
    }
  }
  return draws;
}

// Every cup fixture's tieId, for seeding the seen-tie store on first run.
export function allTieIds(fixturesByComp) {
  const ids = [];
  for (const { comp, fixtures } of fixturesByComp ?? []) {
    if (comp?.type !== 'cup') continue;
    for (const f of fixtures ?? []) ids.push(tieId(comp.id, f.id));
  }
  return ids;
}

// [{ comp, round, roundLabel, club, fixtures }] — the club-centric
// counterpart to unrevealedDraws (spec §13.15): a phase round (group-stage,
// league-phase) publishes its whole fixture list in one go, so there's no
// pairing to reveal round-wide the way a knockout draw has. Instead each
// FOLLOWED club gets its own ceremony over just its own fixtures in that
// phase. A (comp, round, club) triple qualifies exactly like a tie draw
// does — every one of the club's fixtures in the round still scheduled,
// every one unseen, and at least two of them (one published fixture is
// scheduling, not a "draw is in" moment) — scoped to that club's fixtures
// rather than the whole round. Note this is the inverse of
// unrevealedDraws's PHASE_ROUNDS check: that function excludes phase
// rounds; this one exists only for them, and never returns a knockout
// round.
export function unrevealedPhaseDraws(fixturesByComp, seenTies, followedIds) {
  const followed = new Set(followedIds ?? []);
  const results = [];
  for (const { comp, fixtures } of fixturesByComp ?? []) {
    if (comp?.type !== 'cup') continue;

    const byRound = new Map();
    for (const f of fixtures ?? []) {
      if (f?.round == null || !PHASE_ROUNDS.has(f.round)) continue;
      if (!byRound.has(f.round)) byRound.set(f.round, []);
      byRound.get(f.round).push(f);
    }

    const compEntries = [];
    for (const [round, roundFixtures] of byRound) {
      const roundLabel = prettifyRound(round) ?? fallbackRoundLabel(round);
      if (!roundLabel) continue;

      const byClub = new Map(); // teamId -> { club, fixtures: [] }
      for (const f of roundFixtures) {
        for (const side of [f.home, f.away]) {
          if (side?.teamId == null || !followed.has(side.teamId)) continue;
          if (!byClub.has(side.teamId)) byClub.set(side.teamId, { club: side, fixtures: [] });
          byClub.get(side.teamId).fixtures.push(f);
        }
      }

      for (const { club, fixtures: clubFixtures } of byClub.values()) {
        // Safety dedupe (a phase round is club-scoped already — a league-
        // phase club plays 8 distinct opponents once each, group stages are
        // single round-robin — so this is a no-op in the real world, but a
        // duplicated fixture from the feed must never double-count or
        // double-render the same opponent). dedupePairings also re-sorts by
        // kickoff, so no separate sort is needed after it.
        const deduped = dedupePairings(clubFixtures);
        if (deduped.length < 2) continue;
        if (!deduped.every(f => f.status === 'scheduled')) continue;
        if (!deduped.every(f => !seenTies?.[tieId(comp.id, f.id)])) continue;
        compEntries.push({ comp, round, roundLabel, club, fixtures: deduped });
      }
    }
    compEntries.sort((a, b) => a.club.name.localeCompare(b.club.name));
    results.push(...compEntries);
  }
  return results;
}

// A club's phase fixtures' tieIds, for marking that club's phase draw seen
// on completion — mirrors allTieIds but scoped to one already-collected
// fixture list (typically an unrevealedPhaseDraws entry's `fixtures`)
// rather than re-deriving it from the whole comp.
export function phaseTieIds(comp, fixtures) {
  return (fixtures ?? []).map(f => tieId(comp.id, f.id));
}
