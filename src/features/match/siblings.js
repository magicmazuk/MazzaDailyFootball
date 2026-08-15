// Round siblings (spec §13.13): other fixtures worth surfacing at the
// bottom of the match room. Same competition, never the fixture itself,
// then narrowed by whichever grouping is meaningful for this fixture —
// its round when it has one (a knockout/group tie), otherwise its local
// calendar day (a league fixture, whose round carries the season name
// rather than a round — see domain/round.js's YEAR_PREFIXED rejection).
export function siblingFixtures(allFixtures, fixture, limit = 8) {
  const sameComp = allFixtures.filter(f => f.compId === fixture.compId && f.id !== fixture.id);
  const grouped = fixture.round != null
    ? sameComp.filter(f => f.round === fixture.round)
    : sameComp.filter(f =>
        new Date(f.kickoff).toDateString() === new Date(fixture.kickoff).toDateString());
  return grouped
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(0, limit);
}
