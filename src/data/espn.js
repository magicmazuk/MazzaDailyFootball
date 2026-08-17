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
  // These already fall through to 'ft' via state === 'post', but are named
  // explicitly so a penalty shootout or an AET finish is never mistaken for
  // anything but full time.
  STATUS_FINAL_PEN: 'ft',
  STATUS_FINAL_AET: 'ft',
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
    penaltyScore: competitor.shootoutScore != null && competitor.shootoutScore !== ''
      ? Number(competitor.shootoutScore) : null,
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
      rankChange: s.rankChange ?? 0,
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

// The scout (spec §13.20): a foreign club's domestic-league record, from
// the 'total' record item's NAMED stats array. NEVER parse the `summary`
// string ('3-0-0') — its field order is undocumented, which is exactly why
// the stats array is the source of truth. wins/ties aren't always present
// by name (live-verified: aut.1/teams/{id}?enable=roster names gamesPlayed,
// losses, points, pointsAgainst, pointDifferential but not wins/ties) — when
// both are missing, derive wins from points/losses/played arithmetic
// (points = 3w + d, played = w + d + l) but ONLY when that reconciles to
// non-negative integers exactly; otherwise leave those fields null rather
// than guess.
export function adaptTeamRecord(json) {
  const item = (json?.team?.record?.items ?? []).find(it => it.type === 'total');
  if (!item) return null;
  const byName = Object.fromEntries((item.stats ?? []).map(s => [s.name, s.value]));
  const played = byName.gamesPlayed ?? null;
  const losses = byName.losses ?? null;
  const points = byName.points ?? null;
  let wins = byName.wins ?? null;
  let draws = byName.ties ?? null;

  if (wins == null && draws == null && played != null && losses != null && points != null) {
    const undecided = played - losses; // wins + draws
    const w = (points - undecided) / 2; // points = 3w + d = 2w + (w+d)
    const d = undecided - w;
    if (Number.isInteger(w) && w >= 0 && Number.isInteger(d) && d >= 0) {
      wins = w;
      draws = d;
    }
  }

  return { played, wins, draws, losses, points };
}

export function adaptSummary(json) {
  const events = (json?.keyEvents ?? []).map(k => {
    const participants = k.participants ?? [];
    return {
      minute: k.clock?.displayValue ?? '',
      type: k.type?.text ?? '',
      player: participants[0]?.athlete?.displayName ?? k.athletesInvolved?.[0]?.displayName ?? null,
      playerId: participants[0]?.athlete?.id ?? null,
      playerOff: participants[1]?.athlete?.displayName ?? null,
      playerOffId: participants[1]?.athlete?.id ?? null,
      teamId: k.team?.id ?? null,
      scoringPlay: k.scoringPlay ?? false,
    };
  });
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
      id: p.athlete?.id ?? null,
      name: p.athlete?.displayName ?? '',
      shirt: p.jersey ?? p.athlete?.jersey ?? null,
      starter: p.starter ?? false,
      position: p.position?.abbreviation ?? null,
    })),
  }));
  const liveScore = adaptLiveScore(json);
  const gameInfo = adaptGameInfo(json);
  const form = adaptForm(json);
  const headToHead = adaptHeadToHead(json);
  const standouts = adaptStandouts(json);
  return { events, teamStats, lineups, liveScore, gameInfo, form, headToHead, standouts };
}

// gameInfo.officials carries match officials in no guaranteed order; a
// Referee is preferred over assistants/VAR, falling back to whichever
// official is listed first when none is explicitly tagged Referee.
function adaptGameInfo(json) {
  const gi = json?.gameInfo;
  if (!gi) return null;
  const officials = gi.officials ?? [];
  const referee = officials.find(o => o.position?.displayName === 'Referee') ?? officials[0] ?? null;
  const venueObj = gi.venue ?? null;
  const venue = venueObj?.fullName
    ? (venueObj.address?.city ? `${venueObj.fullName}, ${venueObj.address.city}` : venueObj.fullName)
    : null;
  return {
    attendance: gi.attendance ?? null,
    referee: referee?.displayName ?? null,
    venue,
  };
}

// lastFiveGames is per-team recent form; each event's gameResult is a
// single-letter code, but the feed sometimes carries results (e.g. an
// abandoned match) outside the W/D/L set, so those are filtered out.
function adaptForm(json) {
  const lastFive = json?.lastFiveGames;
  if (!Array.isArray(lastFive) || lastFive.length === 0) return null;
  const form = {};
  for (const t of lastFive) {
    const teamId = t.team?.id;
    if (teamId == null) continue;
    form[teamId] = (t.events ?? [])
      .map(e => e.gameResult)
      .filter(r => r === 'W' || r === 'D' || r === 'L')
      .slice(0, 5);
  }
  return form;
}

// seasonseries[0] is the head-to-head block for the two teams in this
// fixture; its events[] mixes past meetings with a possible future fixture,
// so only completed meetings with both scores present are kept.
function adaptHeadToHead(json) {
  const series = json?.seasonseries?.[0];
  if (!series) return null;
  const meetings = (series.events ?? [])
    .filter(e => e.statusType?.completed)
    .map(e => {
      const competitors = e.competitors ?? [];
      const home = competitors.find(c => c.homeAway === 'home');
      const away = competitors.find(c => c.homeAway === 'away');
      const num = c => (c?.score != null && c.score !== '' ? Number(c.score) : null);
      return {
        date: e.date ?? null,
        // Mirrors adaptScoreboard's side() name chain exactly — the drawer's
        // balance bar matches meetings to this fixture's sides BY NAME, so
        // an unmirrored fallback here would silently drop a meeting from
        // the tally whenever ESPN omits displayName (v1.4 review, Low).
        homeName: home?.team?.displayName ?? home?.team?.name ?? null,
        awayName: away?.team?.displayName ?? away?.team?.name ?? null,
        homeScore: num(home),
        awayScore: num(away),
      };
    })
    .filter(m => m.homeScore != null && m.awayScore != null);
  return { summary: series.summary ?? null, meetings };
}

const STANDOUT_CATEGORIES = [
  { key: 'totalShots', label: 'Shots' },
  { key: 'saves', label: 'Saves' },
  { key: 'accuratePasses', label: 'Passes' },
];

function adaptStandouts(json) {
  const leaders = json?.leaders;
  if (!Array.isArray(leaders) || leaders.length === 0) return null;
  return leaders.map(t => {
    const categories = t.leaders ?? [];
    const entries = STANDOUT_CATEGORIES.map(({ key, label }) => {
      const top = categories.find(c => c.name === key)?.leaders?.[0];
      return top
        ? { label, player: top.athlete?.displayName ?? null, playerId: top.athlete?.id ?? null,
            value: top.displayValue ?? null }
        : null;
    }).filter(Boolean);
    return {
      teamId: t.team?.id ?? null,
      teamName: t.team?.displayName ?? null,
      entries,
    };
  });
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
