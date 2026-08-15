import { PHASE_ROUNDS } from '../../domain/draws.js';

// A team's season across every competition we cover (spec §7.5).
export function teamFixtures(allFixtures, teamId, now = new Date()) {
  const all = allFixtures
    .filter(f => f.home.teamId === teamId || f.away.teamId === teamId)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const next = all.find(f => f.status === 'scheduled' && new Date(f.kickoff) >= now) ?? null;
  const last = [...all].reverse().find(f => f.status === 'ft') ?? null;
  return { all, next, last };
}

// Team-page replay-link candidates (spec §13.15): every (compId, round)
// phase group among the given fixtures — already scoped to one club, e.g.
// teamFixtures(...).all — with 2 or more fixtures. Browsable regardless of
// status or seen-state (unlike the Today invitation, this isn't gated by
// followed-ness or unrevealed-ness — "replay the draw" works for any club,
// any time, per the brief). A single fixture is broadcast scheduling, not
// a draw, mirroring unrevealedPhaseDraws' own >=2 threshold (draws.js).
export function phaseReplayGroups(fixtures) {
  const counts = new Map(); // "compId:round" -> count
  for (const f of fixtures ?? []) {
    if (!PHASE_ROUNDS.has(f.round)) continue;
    const key = `${f.compId}:${f.round}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key]) => {
      const i = key.indexOf(':');
      return { compId: key.slice(0, i), round: key.slice(i + 1) };
    });
}
