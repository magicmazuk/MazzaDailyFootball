// What's on TV (spec §13.6): upcoming televised fixtures from the
// curated data, next fortnight, capped.
export function upcomingTv(fixtures, now = new Date(), days = 14, limit = 8) {
  const horizon = now.getTime() + days * 86400000;
  return fixtures
    .filter(f => f.status === 'scheduled' && f.tv?.length
      && new Date(f.kickoff) >= now && new Date(f.kickoff).getTime() <= horizon)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(0, limit);
}
