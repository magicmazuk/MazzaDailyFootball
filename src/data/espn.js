// ESPN → domain adapters (spec §4.3). Nothing above this file may know
// ESPN's response shapes. All lookups are null-safe: these are
// undocumented feeds and absent fields are a normal Tuesday.
import { monogram } from '../domain/monogram.js';

const STATUS_BY_NAME = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_POSTPONED: 'postponed',
  STATUS_CANCELED: 'canceled',
  STATUS_FULL_TIME: 'ft',
  STATUS_FINAL: 'ft',
};

function fixtureStatus(type) {
  if (STATUS_BY_NAME[type?.name]) return STATUS_BY_NAME[type.name];
  if (type?.state === 'in') return 'live';
  if (type?.state === 'post') return 'ft';
  return 'scheduled';
}

function side(competitor = {}) {
  const t = competitor.team ?? {};
  const name = t.displayName ?? t.name ?? 'Unknown';
  return {
    teamId: t.id ?? null,
    name,
    shortName: t.shortDisplayName ?? t.abbreviation ?? name,
    crestUrl: t.logo ?? t.logos?.[0]?.href ?? null,
    monogram: monogram(name),
    colour: t.color ?? null,
    score: competitor.score != null && competitor.score !== '' ? Number(competitor.score) : null,
  };
}

export function adaptScoreboard(json, compId) {
  return (json?.events ?? []).map(ev => {
    const comp = ev.competitions?.[0] ?? {};
    const competitors = comp.competitors ?? [];
    return {
      id: ev.id,
      compId,
      kickoff: ev.date,
      status: fixtureStatus(ev.status?.type),
      minute: ev.status?.displayClock ?? null,
      round: ev.season?.slug ?? null,
      venue: comp.venue?.fullName ?? null,
      home: side(competitors.find(c => c.homeAway === 'home')),
      away: side(competitors.find(c => c.homeAway === 'away')),
    };
  });
}

export function adaptStandings(json) {
  const entries = json?.children?.[0]?.standings?.entries ?? json?.standings?.entries ?? [];
  const rows = entries.map(en => {
    const s = Object.fromEntries((en.stats ?? []).map(x => [x.name, x.value]));
    const t = en.team ?? {};
    const name = t.displayName ?? 'Unknown';
    return {
      teamId: t.id ?? null,
      name,
      crestUrl: t.logos?.[0]?.href ?? null,
      monogram: monogram(name),
      played: s.gamesPlayed ?? 0,
      won: s.wins ?? 0,
      drawn: s.ties ?? 0,
      lost: s.losses ?? 0,
      goalsFor: s.pointsFor ?? 0,
      goalsAgainst: s.pointsAgainst ?? 0,
      goalDifference: s.pointDifferential ?? 0,
      points: s.points ?? 0,
      deduction: s.deductions ?? 0,
      rank: s.rank ?? 99,
    };
  });
  rows.sort((a, b) => a.rank - b.rank);
  return rows.map(({ rank, ...r }, i) => ({ ...r, position: i + 1 }));
}

export function adaptTeams(json) {
  return (json?.sports?.[0]?.leagues?.[0]?.teams ?? []).map(x => {
    const t = x?.team ?? {};
    const name = t.displayName ?? 'Unknown';
    return {
      id: t.id ?? null,
      name,
      shortName: t.shortDisplayName ?? t.abbreviation ?? name,
      crestUrl: t.logos?.[0]?.href ?? null,
      monogram: monogram(name),
      colour: t.color ?? null,
    };
  });
}

export function adaptSquad(json) {
  return (json?.team?.athletes ?? []).map(a => ({
    id: a.id,
    name: a.displayName ?? a.fullName ?? 'Unknown',
    position: a.position?.abbreviation ?? a.position?.name ?? null,
    shirt: a.jersey ?? null,
    age: a.age ?? null,
    nationality: a.citizenship ?? null,
  }));
}

export function adaptSummary(json) {
  const events = (json?.keyEvents ?? []).map(k => ({
    minute: k.clock?.displayValue ?? '',
    type: k.type?.text ?? '',
    player: k.athletesInvolved?.[0]?.displayName ?? null,
    teamId: k.team?.id ?? null,
  }));
  const boxTeams = json?.boxscore?.teams ?? [];
  const teamStats = boxTeams.length === 2
    ? boxTeams.map(t => ({
        teamId: t.team?.id ?? null,
        name: t.team?.displayName ?? '',
        stats: Object.fromEntries((t.statistics ?? []).map(s => [s.name, s.displayValue])),
      }))
    : null;
  const lineups = (json?.rosters ?? []).map(r => ({
    homeAway: r.homeAway ?? null,
    players: (r.roster ?? []).map(p => ({
      name: p.athlete?.displayName ?? '',
      shirt: p.jersey ?? p.athlete?.jersey ?? null,
      starter: p.starter ?? false,
      position: p.position?.abbreviation ?? null,
    })),
  }));
  const liveScore = adaptLiveScore(json);
  return { events, teamStats, lineups, liveScore };
}

// The season/today caches can be up to an hour stale during a live match;
// the summary endpoint's header carries the current score. null when the
// header is absent so callers can fall back to the cached fixture score.
function adaptLiveScore(json) {
  const competitors = json?.header?.competitions?.[0]?.competitors;
  if (!competitors) return null;
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const num = c => (c.score != null && c.score !== '' ? Number(c.score) : null);
  return {
    home: { teamId: home.team?.id ?? null, score: num(home) },
    away: { teamId: away.team?.id ?? null, score: num(away) },
  };
}
