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

// The aggregate in hand, beside a decider leg's score (user ask,
// 2026-08-25, sketched mid-match at Linz): { home, away } totals for THIS
// fixture's orientation, or null. Leg 2 only — leg 1's aggregate IS its
// score. Freshness rule: when the PLAYED other leg is at hand (the match
// page passes it), the total is computed other + current, so a live leg's
// aggregate moves with the header's overlaid score; otherwise the feed's
// own side.agg stands (rows read score and agg from one payload, so they
// agree with each other by construction).
export function aggScores(fixture, other = null) {
  if (fixture?.leg !== 2) return null;
  const num = v => {
    const n = Number(v);
    return v == null || String(v).trim() === '' || Number.isNaN(n) ? null : n;
  };
  if (other && other.status === 'ft') {
    const scoreFor = (f, teamId) =>
      f.home.teamId === teamId ? num(f.home.score)
        : f.away.teamId === teamId ? num(f.away.score) : null;
    const homePrev = scoreFor(other, fixture.home.teamId);
    const awayPrev = scoreFor(other, fixture.away.teamId);
    const homeNow = num(fixture.home.score);
    const awayNow = num(fixture.away.score);
    if (homePrev != null && awayPrev != null && homeNow != null && awayNow != null) {
      return { home: homePrev + homeNow, away: awayPrev + awayNow };
    }
  }
  if (fixture.home.agg == null || fixture.away.agg == null) return null;
  return { home: fixture.home.agg, away: fixture.away.agg };
}
