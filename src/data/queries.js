// TanStack Query hooks — the only place queryKeys and staleTimes live.
// Client staleTimes mirror the proxy's edge TTLs (spec §4.2) so the two
// cache layers agree about freshness.
import { useQueries, useQuery } from '@tanstack/react-query';
import { SEASON } from '../domain/competitions.js';
import { computeTable } from '../domain/table.js';
import { adaptScoreboard, adaptStandings, adaptSquad, adaptSummary, adaptTeams } from './espn.js';
import { adaptBbcFixtures } from './bbc.js';
import { bbcUrl, espnUrl, getJson } from './client.js';

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

export function seasonFixturesQuery(comp) {
  return {
    queryKey: ['season', comp.id],
    staleTime: HOUR,
    queryFn: async () => {
      if (comp.source === 'bbc') {
        const windows = monthWindows(SEASON.bbcStart, SEASON.bbcEnd);
        const results = await Promise.all(
          windows.map(w => getJson(bbcUrl(comp.id, w.start, w.end))));
        return {
          fixtures: results.flatMap(({ data }) => adaptBbcFixtures(data, comp.id)),
          asOf: results.map(r => r.asOf).find(Boolean) ?? null,
        };
      }
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: SEASON.espnRange, limit: 500 }));
      return { fixtures: adaptScoreboard(data, comp.id), asOf };
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
        const [y, t] = await Promise.all([
          getJson(bbcUrl(comp.id, isoDay(yesterday), isoDay(yesterday))),
          getJson(bbcUrl(comp.id, isoDay(now), isoDay(now))),
        ]);
        return {
          fixtures: [...adaptBbcFixtures(y.data, comp.id), ...adaptBbcFixtures(t.data, comp.id)],
          asOf: y.asOf ?? t.asOf ?? null,
        };
      }
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/scoreboard`, { dates: `${ymd(yesterday)}-${ymd(now)}` }));
      return { fixtures: adaptScoreboard(data, comp.id), asOf };
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
      return { teams: adaptTeams(data), asOf };
    },
  };
}

export const useTeams = comp => useQuery(teamsQuery(comp));
export const useAllTeams = comps => useQueries({ queries: comps.map(teamsQuery) });

export function useSquad(comp, teamId) {
  return useQuery({
    queryKey: ['squad', comp.id, teamId],
    enabled: !!comp?.hasSquads && !!teamId,
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const { data, asOf } = await getJson(
        espnUrl(`${SOCCER}/${comp.id}/teams/${teamId}`, { enable: 'roster' }));
      return { players: adaptSquad(data), asOf };
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
