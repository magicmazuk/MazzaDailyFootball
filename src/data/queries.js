// TanStack Query hooks — the only place queryKeys and staleTimes live.
// Client staleTimes mirror the proxy's edge TTLs (spec §4.2) so the two
// cache layers agree about freshness.
import { useQueries, useQuery } from '@tanstack/react-query';
import { SEASON } from '../domain/competitions.js';
import { computeTable } from '../domain/table.js';
import { adaptScoreboard, adaptStandings, adaptSquad, adaptSummary, adaptTeams } from './espn.js';
import { adaptAthlete, adaptPlayerStats } from './player.js';
import { adaptBbcFixtures } from './bbc.js';
import { applyTv } from './tv.js';
import { bbcUrl, espnUrl, getJson } from './client.js';
import { buildTeamIndex, mergeCupFixtures } from './mergeCup.js';

const SOCCER = '/apis/site/v2/sports/soccer';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Poll only when there is something to poll for: 30s while any match is
// live, 60s when one kicks off within two hours, otherwise silence.
export function pollMs(fixtures, now = Date.now()) {
  if (!fixtures?.length) return false;
  if (fixtures.some(f => f.status === 'live')) return 30000;
  const soonMs = 2 * HOUR;
  const soon = fixtures.some(f => f.status === 'scheduled'
    && Math.abs(new Date(f.kickoff).getTime() - now) < soonMs);
  return soon ? 60000 : false;
}

const visiblePoll = q =>
  typeof document !== 'undefined' && document.visibilityState === 'visible'
    ? pollMs(q.state.data?.fixtures)
    : false;

// The BBC container endpoint only accepts a single day (start===end) or a
// month window starting on the 1st and ending within that same month — it
// 400s on anything wider (e.g. a season-long range). Split any start..end
// range into one window per calendar month so callers can fan out requests
// and concatenate the results.
export function monthWindows(startIso, endIso) {
  const pad = n => String(n).padStart(2, '0');
  let [y, m] = startIso.split('-').slice(0, 2).map(Number);
  const [endY, endM] = endIso.split('-').slice(0, 2).map(Number);
  const windows = [];
  while (y < endY || (y === endY && m <= endM)) {
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
    windows.push({ start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return windows;
}

// The BBC month-window fan-out shared by bbc-source competitions' season
// fetch and the cup fallback's BBC leg (§13.7) — same requests, same
// concatenation, just parameterised on which tournament/compId to use.
async function bbcSeasonFixtures(tournament, compId) {
  const windows = monthWindows(SEASON.bbcStart, SEASON.bbcEnd);
  const results = await Promise.all(
    windows.map(w => getJson(bbcUrl(tournament, w.start, w.end))));
  return {
    fixtures: results.flatMap(({ data }) => adaptBbcFixtures(data, compId)),
    asOf: results.map(r => r.asOf).find(Boolean) ?? null,
  };
}

// The two-single-day-request pattern shared by bbc-source competitions'
// today-window fetch and the cup fallback's BBC leg (§13.7).
async function bbcTodayWindowFixtures(tournament, compId, yesterday, now) {
  const [y, t] = await Promise.all([
    getJson(bbcUrl(tournament, isoDay(yesterday), isoDay(yesterday))),
    getJson(bbcUrl(tournament, isoDay(now), isoDay(now))),
  ]);
  return {
    fixtures: [...adaptBbcFixtures(y.data, compId), ...adaptBbcFixtures(t.data, compId)],
    asOf: y.asOf ?? t.asOf ?? null,
  };
}

// Fetch sco.1 and sco.2 teams (edge-cached upstream; cheap) and index them
// by normalized name, for re-identifying BBC cup sides onto ESPN teams.
async function espnTeamIndex() {
  const [t1, t2] = await Promise.all([
    getJson(espnUrl(`${SOCCER}/sco.1/teams`)),
    getJson(espnUrl(`${SOCCER}/sco.2/teams`)),
  ]);
  return {
    index: buildTeamIndex(adaptTeams(t1.data), adaptTeams(t2.data)),
    asOf: t1.asOf ?? t2.asOf ?? null,
  };
}

// espnQualifier comps (the three UEFA club competitions, §13.11) merge
// their own scoreboard with ESPN's separate qualifying-rounds code, so
// qualifying clubs appear tiered alongside the league phase on one page.
// Same degrade-independently shape as settledCupFixtures below: either
// leg may be empty or failing, only throw when both are unavailable.
// Both legs are adapted with the PARENT comp's id (never the qualifier
// code) so every downstream cache key, route and TV match keys off one
// compId. Fixtures are deduped by id (first — the main leg — wins) and
// resorted by kickoff, since the two legs' rounds interleave rather than
// one strictly preceding the other in fetch order.
async function espnQualifierFixtures(mainPromise, qualPromise, compId) {
  const [mainRes, qualRes] = await Promise.allSettled([mainPromise, qualPromise]);
  if (mainRes.status === 'rejected' && qualRes.status === 'rejected') {
    throw mainRes.reason;
  }
  const mainFixtures = mainRes.status === 'fulfilled' ? adaptScoreboard(mainRes.value.data, compId) : [];
  const qualFixtures = qualRes.status === 'fulfilled' ? adaptScoreboard(qualRes.value.data, compId) : [];
  const seen = new Set();
  const fixtures = [...mainFixtures, ...qualFixtures]
    .filter(f => (seen.has(f.id) ? false : seen.add(f.id)))
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const asOf = [
    mainRes.status === 'fulfilled' ? mainRes.value.asOf : null,
    qualRes.status === 'fulfilled' ? qualRes.value.asOf : null,
  ].find(Boolean) ?? null;
  return { fixtures, asOf };
}

// The three legs of a cup fallback fetch (ESPN scoreboard, BBC fixtures,
// ESPN teams for re-identification) degrade independently rather than
// all-or-nothing: one leg failing must never blank a page that has data
// from the others. Only throw when every leg is unavailable. A rejected
// BBC leg means no extra fixtures; a rejected teams leg means BBC sides
// keep their own BBC identity (no re-identification) — both acceptable
// degradations, never a blank screen.
async function settledCupFixtures(espnPromise, bbcPromise, teamsPromise, compId) {
  const [espnRes, bbcRes, teamsRes] = await Promise.allSettled([espnPromise, bbcPromise, teamsPromise]);
  if (espnRes.status === 'rejected' && bbcRes.status === 'rejected' && teamsRes.status === 'rejected') {
    throw espnRes.reason;
  }
  const espnFixtures = espnRes.status === 'fulfilled' ? adaptScoreboard(espnRes.value.data, compId) : [];
  const bbcFixtures = bbcRes.status === 'fulfilled' ? bbcRes.value.fixtures : [];
  const index = teamsRes.status === 'fulfilled' ? teamsRes.value.index : new Map();
  const asOf = [
    espnRes.status === 'fulfilled' ? espnRes.value.asOf : null,
    bbcRes.status === 'fulfilled' ? bbcRes.value.asOf : null,
    teamsRes.status === 'fulfilled' ? teamsRes.value.asOf : null,
  ].find(Boolean) ?? null;
  return {
    fixtures: applyTv(mergeCupFixtures(espnFixtures, bbcFixtures, index, compId)),
    asOf,
  };
}

export function seasonFixturesQuery(comp) {
  return {
    queryKey: ['season', comp.id],
    staleTime: HOUR,
    queryFn: async () => {
      if (comp.source === 'bbc') {
        const { fixtures, asOf } = await bbcSeasonFixtures(comp.id, comp.id);
        return { fixtures: applyTv(fixtures), asOf };
      }
      if (comp.bbcTournament) {
        return settledCupFixtures(
          getJson(espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: SEASON.espnRange, limit: 500 })),
          bbcSeasonFixtures(comp.bbcTournament, comp.id),
          espnTeamIndex(),
          comp.id,
        );
      }
      if (comp.espnQualifier) {
        const { fixtures, asOf } = await espnQualifierFixtures(
          getJson(espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: SEASON.espnRange, limit: 500 })),
          getJson(espnUrl(`${SOCCER}/${comp.espnQualifier}/scoreboard`, { dates: SEASON.espnRange, limit: 500 })),
          comp.id,
        );
        return { fixtures: applyTv(fixtures), asOf };
      }
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: SEASON.espnRange, limit: 500 }));
      return { fixtures: applyTv(adaptScoreboard(data, comp.id)), asOf };
    },
  };
}

export const useSeasonFixtures = comp => useQuery(seasonFixturesQuery(comp));
export const useAllSeasonFixtures = comps =>
  useQueries({ queries: comps.map(seasonFixturesQuery) });

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Yesterday + today in one window per competition — one request feeds
// the Live, Later Today and Yesterday sections at once.
export function todayWindowQuery(comp, now = new Date()) {
  const yesterday = new Date(now.getTime() - 24 * HOUR);
  return {
    queryKey: ['window', comp.id, ymd(yesterday), ymd(now)],
    staleTime: 30 * 1000,
    refetchInterval: visiblePoll,
    queryFn: async () => {
      if (comp.source === 'bbc') {
        const { fixtures, asOf } = await bbcTodayWindowFixtures(comp.id, comp.id, yesterday, now);
        return { fixtures: applyTv(fixtures), asOf };
      }
      if (comp.bbcTournament) {
        return settledCupFixtures(
          getJson(espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: `${ymd(yesterday)}-${ymd(now)}` })),
          bbcTodayWindowFixtures(comp.bbcTournament, comp.id, yesterday, now),
          espnTeamIndex(),
          comp.id,
        );
      }
      if (comp.espnQualifier) {
        const { fixtures, asOf } = await espnQualifierFixtures(
          getJson(espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: `${ymd(yesterday)}-${ymd(now)}` })),
          getJson(espnUrl(`${SOCCER}/${comp.espnQualifier}/scoreboard`, { dates: `${ymd(yesterday)}-${ymd(now)}` })),
          comp.id,
        );
        return { fixtures: applyTv(fixtures), asOf };
      }
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: `${ymd(yesterday)}-${ymd(now)}` }));
      return { fixtures: applyTv(adaptScoreboard(data, comp.id)), asOf };
    },
  };
}

export const useTodayWindows = comps =>
  useQueries({ queries: comps.map(c => todayWindowQuery(c)) });

export function useTable(comp) {
  const season = useSeasonFixtures(comp);
  const espn = useQuery({
    queryKey: ['table', comp.id],
    enabled: comp.source === 'espn' && !!comp.hasTable,
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data, asOf } = await getJson(
        espnUrl(`/apis/v2/sports/soccer/${comp.id}/standings`, { season: SEASON.espnYear }));
      return { rows: adaptStandings(data), asOf };
    },
  });
  if (comp.hasTable === 'computed') {
    const fixtures = season.data?.fixtures;
    return {
      isLoading: season.isLoading,
      isError: season.isError,
      data: fixtures
        ? { rows: computeTable(fixtures), asOf: season.data.asOf, fixtures }
        : undefined,
    };
  }
  return {
    isLoading: espn.isLoading || season.isLoading,
    isError: espn.isError,
    data: espn.data
      ? { ...espn.data, fixtures: season.data?.fixtures ?? [] }
      : undefined,
  };
}

export function teamsQuery(comp) {
  return {
    queryKey: ['teams', comp.id],
    enabled: comp.source === 'espn',
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const { data, asOf } = await getJson(espnUrl(`${SOCCER}/${comp.id}/teams`));
      return { teams: adaptTeams(data).map(t => ({ ...t, compId: comp.id })), asOf };
    },
  };
}

export const useTeams = comp => useQuery(teamsQuery(comp));
export const useAllTeams = comps => useQueries({ queries: comps.map(teamsQuery) });

// Production regression (hotfix, Aug 2026): ESPN only populates a
// team's roster (athletes[]) under the club's DOMESTIC league grouping —
// fetched under a UEFA/cup comp, teams/{id}?enable=roster 200s with an
// empty athletes array. European qualifying week makes that the common
// navigation context, so useSquad tries the route comp first, then falls
// back through the three big domestic groupings (skipping whichever one
// is already the route comp) until one returns a non-empty squad — all
// legs are edge-cached upstream, so the fallback is cheap. If every leg
// comes back empty this resolves successfully with players: [], never a
// query error — TeamScreen renders a distinct "unavailable" line for
// that rather than treating it as a failed fetch.
const SQUAD_FALLBACK_LEAGUES = ['sco.1', 'sco.2', 'eng.1'];

export function useSquad(comp, teamId) {
  return useQuery({
    queryKey: ['squad', teamId],
    enabled: !!comp?.hasSquads && !!teamId,
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const candidates = [comp.id, ...SQUAD_FALLBACK_LEAGUES.filter(id => id !== comp.id)];
      let lastAsOf = null;
      let lastError = null;
      let anyLegSucceeded = false;
      for (const leagueId of candidates) {
        try {
          const { data, asOf } = await getJson(
            espnUrl(`${SOCCER}/${leagueId}/teams/${teamId}`, { enable: 'roster' }));
          anyLegSucceeded = true;
          lastAsOf = asOf ?? lastAsOf;
          const players = adaptSquad(data);
          if (players.length > 0) return { players, asOf, resolvedCompId: leagueId };
        } catch (err) {
          // this league grouping either has no roster for this team, or the
          // fetch itself failed — keep trying the remaining legs either way,
          // but remember the failure: if EVERY leg throws (a full outage,
          // not just an empty roster), that must surface as isError rather
          // than silently caching as a legit empty squad for 24h.
          lastError = err;
        }
      }
      if (!anyLegSucceeded && lastError) throw lastError;
      return { players: [], asOf: lastAsOf, resolvedCompId: null };
    },
  });
}

export function useMatchDetail(comp, eventId, isLive) {
  return useQuery({
    queryKey: ['summary', comp.id, eventId],
    enabled: !!comp?.hasMatchDetail && !!eventId,
    staleTime: 30 * 1000,
    refetchInterval: isLive && typeof document !== 'undefined'
      && document.visibilityState === 'visible' ? 30000 : false,
    queryFn: async () => {
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/summary`, { event: eventId }));
      return { detail: adaptSummary(data), asOf };
    },
  });
}

// Player bio + season statistics (spec §13.16) — a different ESPN host
// (sports.core.api.espn.com) behind the proxy's second allowlist, so the
// path shape differs from every other query here: no /apis prefix, and
// season/type live in the path rather than as query params. BBC comps
// carry no player data at all — enabled is false for them, and callers
// (T2) must not offer player links on a BBC-source competition.
//
// Production regression (hotfix, Aug 2026): ESPN only populates a
// player's season statistics under their club's DOMESTIC league
// grouping — fetched under a UEFA/cup comp, the statistics leg 404s
// even though the bio itself fetches fine under any grouping. So bio
// is always fetched under the ROUTE comp (as before), but the stats
// query waits for bio to resolve and then fetches under
// bio.defaultLeagueCode (extracted from the bio payload) when present,
// falling back to the route comp otherwise. isError reflects the
// ATHLETE fetch only — a stats-only failure must never blank the page,
// since every stat section already null-renders when stats is absent.
export function usePlayer(comp, playerId) {
  const bioEnabled = comp?.source === 'espn' && !!playerId;
  const routeBase = `/v2/sports/soccer/leagues/${comp?.id}/seasons/${SEASON.espnYear}`;
  const athlete = useQuery({
    queryKey: ['player', comp?.id, playerId],
    enabled: bioEnabled,
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const { data } = await getJson(espnUrl(`${routeBase}/athletes/${playerId}`));
      return adaptAthlete(data);
    },
  });
  const bio = athlete.data ?? null;
  const statsLeagueId = bio?.defaultLeagueCode ?? comp?.id;
  const statsBase = `/v2/sports/soccer/leagues/${statsLeagueId}/seasons/${SEASON.espnYear}`;
  const stats = useQuery({
    queryKey: ['playerStats', statsLeagueId, playerId],
    enabled: bioEnabled && !!bio,
    staleTime: 10 * MIN,
    queryFn: async () => {
      const { data } = await getJson(espnUrl(`${statsBase}/types/1/athletes/${playerId}/statistics`));
      return adaptPlayerStats(data);
    },
  });
  return {
    bio,
    stats: stats.data ?? null,
    isLoading: athlete.isLoading || stats.isLoading,
    isError: athlete.isError,
  };
}
