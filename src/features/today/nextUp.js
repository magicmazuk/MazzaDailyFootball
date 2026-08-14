// "Next up" (spec §13.1): followed clubs with no game today show their
// next fixture. Pure; fed from the season caches — no new requests.
export function nextUpForFollowed(followedClubs, allFixtures, now = new Date()) {
  const todayKey = now.toDateString();
  const involves = (f, id) => f.home.teamId === id || f.away.teamId === id;
  return followedClubs
    .filter(club => !allFixtures.some(f =>
      involves(f, club.id) && new Date(f.kickoff).toDateString() === todayKey))
    .map(club => ({
      club,
      fixture: allFixtures
        .filter(f => involves(f, club.id) && f.status === 'scheduled'
          && new Date(f.kickoff) >= now)
        .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0] ?? null,
    }))
    .filter(x => x.fixture)
    .sort((a, b) => new Date(a.fixture.kickoff) - new Date(b.fixture.kickoff));
}
