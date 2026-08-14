import { prettifyRound } from './round.js';

test.each([
  ['fourth-round', 'Fourth round'],
  ['round-2', 'Round 2'],
  ['quarterfinals', 'Quarter-finals'],
  ['semifinals', 'Semi-finals'],
  ['final', 'Final'],
  ['regular-season', null],
  ['league-phase', null],
  ['group-stage', null],
  [null, null],
  // ESPN league fixtures (as opposed to cup/knockout ones) carry the
  // SEASON name in season.slug, not a round — '2026-27-scottish-premiership'
  // (sco.1), '2025-26-english-premier-league' (eng.1). No real round slug
  // starts with a year, so any '<yyyy>-<yy>-...' prefix is rejected outright.
  ['2026-27-scottish-premiership', null],
  ['2025-26-english-premier-league', null],
])('prettifyRound(%j) -> %j', (input, expected) => {
  expect(prettifyRound(input)).toBe(expected);
});
