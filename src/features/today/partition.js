// Sorts the two-day fixture window into the Today sections (spec §7.2).
// Followed clubs are pulled out first — prioritise, never hide.
export function partitionToday(fixtures, followedIds, now = new Date()) {
  const todayKey = now.toDateString();
  const isToday = f => new Date(f.kickoff).toDateString() === todayKey;
  const isFollowed = f => followedIds.has(f.home.teamId) || followedIds.has(f.away.teamId);
  const byKickoff = (a, b) => new Date(a.kickoff) - new Date(b.kickoff);
  const liveFirst = f => (f.status === 'live' ? 0 : 1);

  const today = fixtures.filter(isToday);
  const rest = today.filter(f => !isFollowed(f));
  return {
    yours: today.filter(isFollowed)
      .sort((a, b) => liveFirst(a) - liveFirst(b) || byKickoff(a, b)),
    live: rest.filter(f => f.status === 'live').sort(byKickoff),
    later: rest.filter(f => f.status === 'scheduled').sort(byKickoff),
    earlier: rest.filter(f => ['ft', 'postponed', 'canceled'].includes(f.status))
      .sort(byKickoff),
    yesterday: fixtures.filter(f => !isToday(f))
      .sort((a, b) => (isFollowed(b) ? 1 : 0) - (isFollowed(a) ? 1 : 0) || byKickoff(a, b)),
  };
}
