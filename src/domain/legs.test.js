import { expect, test } from 'vitest';
import { aggScores, otherLeg, tieLine } from './legs.js';

const side = (teamId, name, score, agg) => ({ teamId, name, shortName: name, score, agg });
const leg2 = {
  id: 'L2', compId: 'uefa.champions', round: 'third-qualifying-round',
  kickoff: '2026-08-12T18:45Z', status: 'ft', leg: 2, tieCompleted: true, tieWinnerId: '490',
  home: side('2528', 'Kairat Almaty', 0, 0),
  away: side('490', 'Levski Sofia', 1, 2),
};
const leg1 = {
  id: 'L1', compId: 'uefa.champions', round: 'third-qualifying-round',
  kickoff: '2026-08-05T18:00Z', status: 'ft', leg: 1, tieCompleted: false, tieWinnerId: null,
  home: side('490', 'Levski Sofia', 1, null),
  away: side('2528', 'Kairat Almaty', 0, null),
};

// --- tieLine: the verdict, oriented like penaltyResult ---
test('tieLine: names the side going through with the aggregate, even when the leg score points the other way', () => {
  const line = tieLine({ ...leg2,
    home: side('2528', 'Kairat', 1, 1), away: side('490', 'Levski', 0, 2) });
  // Kairat won the leg 1-0; Levski go through 2-1 on aggregate.
  expect(line).toEqual({ winnerName: 'Levski', winnerAgg: 2, loserAgg: 1, level: false });
});

test('tieLine: a level aggregate still names the winner (the feed flags who advanced) and says it was level', () => {
  const line = tieLine({ ...leg2,
    home: side('2528', 'Kairat', 2, 3), away: side('490', 'Levski', 1, 3) });
  expect(line).toEqual({ winnerName: 'Levski', winnerAgg: 3, loserAgg: 3, level: true });
});

test('tieLine: null before the tie is decided, on ordinary fixtures, and when aggregates are unpublished', () => {
  expect(tieLine(leg1)).toBeNull();
  expect(tieLine({ ...leg2, leg: null, tieCompleted: null, tieWinnerId: null })).toBeNull();
  expect(tieLine({ ...leg2, home: side('2528', 'Kairat', 0, null) })).toBeNull();
  // A winner id matching neither side must yield null, never a guess.
  expect(tieLine({ ...leg2, tieWinnerId: '999' })).toBeNull();
});

// --- otherLeg: the paired fixture, by the draws' own pairing key ---
test('otherLeg: finds the reversed-venue first leg in the same round', () => {
  expect(otherLeg(leg2, [leg1, leg2])).toBe(leg1);
  expect(otherLeg(leg1, [leg1, leg2])).toBe(leg2);
});

test('otherLeg: null for ordinary fixtures, unpaired legs, and same-clubs-different-round', () => {
  expect(otherLeg({ ...leg2, leg: null }, [leg1, leg2])).toBeNull();
  expect(otherLeg(leg2, [leg2])).toBeNull();
  expect(otherLeg(leg2, [leg2, { ...leg1, round: 'playoff-round' }])).toBeNull();
});

// --- aggScores (the aggregate in hand, user ask 2026-08-25) ---

const legFx = (over = {}) => ({
  id: 'L2', leg: 2, status: 'live',
  home: { teamId: 'lask', name: 'LASK Linz', score: '0', agg: 0 },
  away: { teamId: '256', name: 'Celtic', score: '1', agg: 4 },
  ...over,
});

test('aggScores: a decider leg with published aggregates reads them per side', () => {
  expect(aggScores(legFx())).toEqual({ home: 0, away: 4 });
});

test('aggScores: leg one shows nothing — its aggregate IS its score', () => {
  expect(aggScores(legFx({ leg: 1 }))).toBeNull();
});

test('aggScores: no leg at all (a normal match) shows nothing', () => {
  expect(aggScores(legFx({ leg: null }))).toBeNull();
});

test('aggScores: a missing aggregate on either side renders nothing, never a guess', () => {
  const fx = legFx();
  fx.home = { ...fx.home, agg: null };
  expect(aggScores(fx)).toBeNull();
});

test('aggScores: with the played other leg in hand, the total is COMPUTED so a live leg moves with the fresh score', () => {
  const other = { id: 'L1', leg: 1, status: 'ft',
    home: { teamId: '256', name: 'Celtic', score: '3' },
    away: { teamId: 'lask', name: 'LASK Linz', score: '0' } };
  // stale feed aggs (3/0) but the live score already says 1 — computed wins
  const live = legFx({ home: { teamId: 'lask', name: 'LASK Linz', score: '0', agg: 0 },
    away: { teamId: '256', name: 'Celtic', score: '1', agg: 3 } });
  expect(aggScores(live, other)).toEqual({ home: 0, away: 4 });
});

test('aggScores: an unplayed other leg never joins the sum — feed aggregates stand', () => {
  const other = { id: 'L1', leg: 1, status: 'scheduled',
    home: { teamId: '256', score: '0' }, away: { teamId: 'lask', score: '0' } };
  expect(aggScores(legFx(), other)).toEqual({ home: 0, away: 4 });
});
