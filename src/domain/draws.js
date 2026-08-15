// Draw detection (spec §8.1, §13.14). Pure derivation over the standard
// Fixture shape and the persisted seenTies map — no UI, no fetching. A
// "draw" is a cup round whose ties are all still scheduled and all unseen:
// the feed has published pairings the app hasn't shown yet.
import { prettifyRound } from './round.js';
import { fallbackRoundLabel } from './field.js';

export const tieId = (compId, fixtureId) => `${compId}:${fixtureId}`;

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
      if (roundFixtures.length < 2) continue;
      if (!roundFixtures.every(f => f.status === 'scheduled')) continue;
      if (!roundFixtures.every(f => !seenTies?.[tieId(comp.id, f.id)])) continue;
      const roundLabel = prettifyRound(round) ?? fallbackRoundLabel(round);
      if (!roundLabel) continue;

      const ties = [...roundFixtures].sort(
        (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
      );
      draws.push({ comp, round, roundLabel, ties });
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
        if (clubFixtures.length < 2) continue;
        if (!clubFixtures.every(f => f.status === 'scheduled')) continue;
        if (!clubFixtures.every(f => !seenTies?.[tieId(comp.id, f.id)])) continue;
        const sorted = [...clubFixtures].sort(
          (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
        );
        compEntries.push({ comp, round, roundLabel, club, fixtures: sorted });
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
