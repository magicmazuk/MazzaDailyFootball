// Last-n form for a team across a fixture list, oldest → newest.
export function formGuide(fixtures, teamId, n = 5) {
  return fixtures
    .filter(f => f.status === 'ft'
      && (f.home.teamId === teamId || f.away.teamId === teamId)
      && f.home.score != null && f.away.score != null)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(-n)
    .map(f => {
      const mine = f.home.teamId === teamId ? f.home.score : f.away.score;
      const theirs = f.home.teamId === teamId ? f.away.score : f.home.score;
      return mine > theirs ? 'W' : mine === theirs ? 'D' : 'L';
    });
}
