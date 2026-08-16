// The start of the day AFTER `now`, in local calendar terms — matches
// dayKey()/partitionToday's local-day convention elsewhere in the app.
function startOfTomorrow(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

// What's on TV (spec §13.6): upcoming televised fixtures from the
// curated data, next fortnight, capped. The window starts at the start of
// TOMORROW (backlog, spec §13.18.4), not now — a fixture kicking off later
// today is already shown under Live/Later today, so including it here
// would duplicate it.
export function upcomingTv(fixtures, now = new Date(), days = 14, limit = 8) {
  const start = startOfTomorrow(now);
  const horizon = now.getTime() + days * 86400000;
  return fixtures
    .filter(f => f.status === 'scheduled' && f.tv?.length
      && new Date(f.kickoff) >= start && new Date(f.kickoff).getTime() <= horizon)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(0, limit);
}
