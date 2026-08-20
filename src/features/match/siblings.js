import { prettifyRound } from '../../domain/round.js';

// Round siblings (spec §13.13): other fixtures worth surfacing at the
// bottom of the match room. Same competition, never the fixture itself,
// then narrowed by whichever grouping is meaningful for this fixture —
// its round when it has one (a knockout/group tie), otherwise its local
// calendar day (a league fixture, whose round carries the season name
// rather than a round — see domain/round.js's YEAR_PREFIXED rejection).
export function siblingFixtures(allFixtures, fixture, limit = 8) {
  const sameComp = allFixtures.filter(f => f.compId === fixture.compId && f.id !== fixture.id);
  // A REAL round only (2026-08-20 fix): a league fixture's round is never
  // null — it is the YEAR_PREFIXED season slug the ENTIRE season shares,
  // so the raw != null check matched the whole season and slice(0,8)
  // served the season's earliest games under a fixture weeks away.
  // prettifyRound is the app's one discriminator for "is this a round".
  const grouped = prettifyRound(fixture.round) != null
    ? sameComp.filter(f => f.round === fixture.round)
    : sameComp.filter(f =>
        new Date(f.kickoff).toDateString() === new Date(fixture.kickoff).toDateString());
  return grouped
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(0, limit);
}
