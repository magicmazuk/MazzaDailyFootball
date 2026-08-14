// A team's season across every competition we cover (spec §7.5).
export function teamFixtures(allFixtures, teamId, now = new Date()) {
  const all = allFixtures
    .filter(f => f.home.teamId === teamId || f.away.teamId === teamId)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const next = all.find(f => f.status === 'scheduled' && new Date(f.kickoff) >= now) ?? null;
  const last = [...all].reverse().find(f => f.status === 'ft') ?? null;
  return { all, next, last };
}
