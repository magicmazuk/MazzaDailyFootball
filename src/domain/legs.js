// Two-legged ties (spec §13.29). Pure derivations over the standard
// Fixture shape — no UI, no fetching. The feed does the hard part: legs,
// per-side aggregates and the decided winner arrive on the fixture itself
// (adaptScoreboard); this module only orients them and finds the twin.
import { pairKey } from './draws.js';

// The tie's verdict, oriented for display the way penaltyResult orients a
// shootout: null unless this fixture IS a leg, the tie IS decided, the
// flagged winner IS one of this fixture's sides, and both aggregates were
// actually published — a missing piece renders nothing, never a guess.
// `level` marks an aggregate that finished all square (the winner then
// came via extra time or penalties; the leg's own pens line tells that
// half of the story).
export function tieLine(fixture) {
  if (fixture?.leg == null || fixture.tieCompleted !== true || fixture.tieWinnerId == null) {
    return null;
  }
  const sides = [fixture.home, fixture.away];
  const winner = sides.find(s => s.teamId === fixture.tieWinnerId);
  const loser = sides.find(s => s.teamId !== fixture.tieWinnerId);
  if (!winner || !loser || winner.agg == null || loser.agg == null) return null;
  return {
    winnerName: winner.shortName ?? winner.name,
    winnerAgg: winner.agg,
    loserAgg: loser.agg,
    level: winner.agg === loser.agg,
  };
}

// The paired leg — same round, same two clubs, different fixture — found
// by the draw ceremonies' own pairing key (venue-reversal-proof, round-
// scoped), so legs pair here exactly as they pair in a draw.
export function otherLeg(fixture, fixtures) {
  if (fixture?.leg == null) return null;
  const key = pairKey(fixture);
  return (fixtures ?? []).find(f => f.id !== fixture.id && f.leg != null && pairKey(f) === key)
    ?? null;
}

// '1st leg' / '2nd leg' for context lines — from the leg number alone.
export function legLabel(leg) {
  if (leg === 1) return '1st leg';
  if (leg === 2) return '2nd leg';
  return leg != null ? `leg ${leg}` : null;
}
