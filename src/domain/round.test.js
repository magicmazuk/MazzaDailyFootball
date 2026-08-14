import { prettifyRound } from './round.js';

test.each([
  ['fourth-round', 'Fourth round'],
  ['quarterfinals', 'Quarter-finals'],
  ['semifinals', 'Semi-finals'],
  ['final', 'Final'],
  ['regular-season', null],
  ['league-phase', null],
  ['group-stage', null],
  [null, null],
])('prettifyRound(%j) -> %j', (input, expected) => {
  expect(prettifyRound(input)).toBe(expected);
});
