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
  // UEFA qualifying-rounds code (spec §13.11) real observed season.slug
  // values (curled live from uefa.champions_qual/uefa.europa_qual/
  // uefa.europa.conf_qual — see task-1-report.md for the raw sample).
  // 'first-round'/'second-round'/'third-round' are shared verbatim with
  // eng.league_cup's own early rounds (confirmed live), so they stay on
  // the generic word-capitalising path rather than an irregular mapping —
  // hard-coding a "qualifying" suffix onto those slugs would mislabel the
  // Carabao Cup's genuine First/Second round fixtures too, since
  // prettifyRound has no competition context to disambiguate. Only
  // 'playoff-round' needs an explicit entry, for the hyphenated
  // Broadsheet spelling ("Play-off") already used by zones.js/structure
  // labels elsewhere, which the generic splitter can't produce.
  ['first-round', 'First round'],
  ['second-round', 'Second round'],
  ['third-round', 'Third round'],
  ['playoff-round', 'Play-off round'],
])('prettifyRound(%j) -> %j', (input, expected) => {
  expect(prettifyRound(input)).toBe(expected);
});
