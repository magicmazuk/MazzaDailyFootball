// The fantasy ladder (spec §13.40). Pure derivations over the trimmed
// /fpl/index shape — no fetching, no React. EPL-only by data reality
// (ESPN has no fantasy soccer game; the SPFL none at all). The rule that
// matters: an index whose players carry no numeric points — the edge can
// serve the pre-points trimmed cache for hours after §13.40 ships — is
// refused outright. Absent beats a ladder of fake zeros.
import { fplTeamId } from './dossier.js';

const hasPoints = p => typeof p?.points === 'number';

const row = p => ({ name: p.web, points: p.points, event: p.event ?? null });

const ranked = players => [...players].sort((a, b) => b.points - a.points);

// The club's own top n, matched to its FPL team the dossier way (uniquely,
// never across teams). Null when the club doesn't match or the index
// predates points; [] never happens in practice (a matched team has men).
export function fplLadder(index, club, n = 10) {
  const teamId = fplTeamId(index, club);
  if (teamId == null) return null;
  const squad = (index.players ?? []).filter(p => p != null && p.team === teamId);
  if (squad.length === 0 || !squad.every(hasPoints)) return null;
  return ranked(squad).slice(0, n).map(row);
}

// The whole division's top n, each row wearing its club's FPL name.
export function leagueLadder(index, n = 10) {
  if (index == null) return null;
  const players = (index.players ?? []).filter(p => p != null);
  if (players.length === 0 || !players.every(hasPoints)) return null;
  const clubs = new Map((index.teams ?? []).map(t => [t.id, t.name]));
  return ranked(players).slice(0, n)
    .map(p => ({ ...row(p), club: clubs.get(p.team) ?? null }));
}
