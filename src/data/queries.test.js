import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  seasonFixturesQuery, todayWindowQuery, useHighlights, useNews, usePlayer, useSquad,
  useTsdbPlayers, useUpcomingBroadcasts, useWikiSummary,
} from './queries.js';

// No JSX in this file — the QueryClientProvider wrapper is built with
// createElement instead (matches src/features/match/video.test.js).
function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const comp = { id: 'scottish-league-one', source: 'bbc' };

const bbcResponse = id => ({
  eventGroups: [{ secondaryGroups: [{ events: [
    { id, startDateTime: '2026-08-01T14:00:00Z', status: 'PostEvent',
      home: { id: 'h', fullName: 'Home', score: '1' },
      away: { id: 'a', fullName: 'Away', score: '0' } },
  ] }] }],
});

beforeEach(() => { vi.unstubAllGlobals(); });

test('season fixtures for a BBC competition fan out one request per calendar month, never a season-long range', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    const id = new URL(url, 'http://x').searchParams.get('start');
    return new Response(JSON.stringify(bbcResponse(id)), { status: 200 });
  }));

  const { fixtures } = await seasonFixturesQuery(comp).queryFn();

  // Scoped to the BBC requests: the crest index (spec §13.32) may add a
  // one-per-session pair of espn sco.3/sco.4 teams calls alongside.
  const bbcCalls = calls.filter(u => u.includes('/api/bbc'));
  // 2026-07-01 .. 2027-06-30 is 12 calendar months.
  expect(bbcCalls).toHaveLength(12);
  for (const url of bbcCalls) {
    const u = new URL(url, 'http://x');
    const start = u.searchParams.get('start');
    const end = u.searchParams.get('end');
    // Never a season-long window — start and end must share a calendar month.
    expect(start.slice(0, 7)).toBe(end.slice(0, 7));
    expect(start.endsWith('-01')).toBe(true);
  }
  expect(bbcCalls[0]).toContain('start=2026-07-01');
  expect(bbcCalls[0]).toContain('end=2026-07-31');
  expect(bbcCalls[11]).toContain('start=2027-06-01');
  expect(bbcCalls[11]).toContain('end=2027-06-30');
  // Results concatenated in month order, one fixture per month here.
  expect(fixtures).toHaveLength(12);
  expect(fixtures[0].id).toBe('2026-07-01');
  expect(fixtures[11].id).toBe('2027-06-01');
});

test('today window for a BBC competition issues two single-day requests, not a 2-day range', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    const id = new URL(url, 'http://x').searchParams.get('start');
    return new Response(JSON.stringify(bbcResponse(id)), { status: 200 });
  }));

  const now = new Date('2026-08-14T12:00:00Z');
  const { fixtures } = await todayWindowQuery(comp, now).queryFn();

  const bbcCalls = calls.filter(u => u.includes('/api/bbc'));
  expect(bbcCalls).toHaveLength(2);
  for (const url of calls) {
    const u = new URL(url, 'http://x');
    expect(u.searchParams.get('start')).toBe(u.searchParams.get('end'));
  }
  expect(bbcCalls[0]).toContain('start=2026-08-13');
  expect(bbcCalls[0]).toContain('end=2026-08-13');
  expect(bbcCalls[1]).toContain('start=2026-08-14');
  expect(bbcCalls[1]).toContain('end=2026-08-14');
  expect(fixtures).toHaveLength(2);
  expect(fixtures[0].id).toBe('2026-08-13');
  expect(fixtures[1].id).toBe('2026-08-14');
});

const cup = { id: 'sco.cis', source: 'espn', bbcTournament: 'scottish-league-cup' };

const espnScoreboard = () => JSON.stringify({
  events: [{
    id: 'e1', date: '2026-08-01T12:00:00Z', status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '1', displayName: 'Aberdeen' } },
      { homeAway: 'away', team: { id: '2', displayName: 'Hibernian' } },
    ] }],
  }],
});

const bbcCupFixture = () => JSON.stringify({
  eventGroups: [{ secondaryGroups: [{ events: [
    { id: 'b1', startDateTime: '2026-08-15T16:45:00Z', status: 'PreEvent',
      home: { id: 'h', fullName: 'Dundee United' }, away: { id: 'a', fullName: 'Celtic' } },
  ] }] }],
});

const teamsPayload = (id, name) => JSON.stringify({
  sports: [{ leagues: [{ teams: [{ team: { id, displayName: name } }] }] }],
});

function stubCupFetch({ failEspn = false, failBbc = false, failTeams = false } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/scoreboard')) {
      return failEspn ? new Response('down', { status: 500 }) : new Response(espnScoreboard(), { status: 200 });
    }
    if (url.includes('/api/bbc')) {
      if (failBbc) return new Response('down', { status: 500 });
      const start = new URL(url, 'http://x').searchParams.get('start');
      const body = start === '2026-08-01' || start === '2026-08-15' ? bbcCupFixture()
        : JSON.stringify({ eventGroups: [] });
      return new Response(body, { status: 200 });
    }
    if (url.includes('/sco.1/teams')) {
      return failTeams ? new Response('down', { status: 500 }) : new Response(teamsPayload('1', 'Dundee United'), { status: 200 });
    }
    if (url.includes('/sco.2/teams')) {
      return failTeams ? new Response('down', { status: 500 }) : new Response(teamsPayload('256', 'Celtic'), { status: 200 });
    }
    throw new Error(`unexpected url ${url}`);
  }));
  return calls;
}

test('season fixtures for an ESPN comp with a bbcTournament merge ESPN scoreboard with BBC knockout fixtures', async () => {
  const calls = stubCupFetch();

  const { fixtures } = await seasonFixturesQuery(cup).queryFn();

  expect(calls.filter(u => u.includes('/scoreboard'))).toHaveLength(1);
  expect(calls.filter(u => u.includes('/api/bbc'))).toHaveLength(12); // same month-window fan-out
  expect(calls.some(u => u.includes('/sco.1/teams'))).toBe(true);
  expect(calls.some(u => u.includes('/sco.2/teams'))).toBe(true);

  expect(fixtures).toHaveLength(2);
  expect(fixtures.some(f => f.id === 'e1')).toBe(true);
  const merged = fixtures.find(f => f.id === 'bbc-b1');
  expect(merged.compId).toBe('sco.cis');
  // BBC side re-identified onto the ESPN team fetched from sco.1/sco.2 teams.
  expect(merged.home.teamId).toBe('1');
  expect(merged.away.teamId).toBe('256');
});

test('today window for an ESPN comp with a bbcTournament issues two BBC single-day requests and merges', async () => {
  const calls = stubCupFetch();
  const now = new Date('2026-08-15T12:00:00Z');

  const { fixtures } = await todayWindowQuery(cup, now).queryFn();

  expect(calls.filter(u => u.includes('/scoreboard'))).toHaveLength(1);
  const bbcCalls = calls.filter(u => u.includes('/api/bbc'));
  expect(bbcCalls).toHaveLength(2);
  for (const url of bbcCalls) {
    const u = new URL(url, 'http://x');
    expect(u.searchParams.get('start')).toBe(u.searchParams.get('end'));
  }
  expect(fixtures.some(f => f.id === 'bbc-b1')).toBe(true);
});

test('season fixtures degrade to ESPN alone when the BBC leg fails — not all-or-nothing', async () => {
  stubCupFetch({ failBbc: true });
  const { fixtures } = await seasonFixturesQuery(cup).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].id).toBe('e1');
});

test('today window degrades to ESPN alone when the BBC leg fails — not all-or-nothing', async () => {
  stubCupFetch({ failBbc: true });
  const now = new Date('2026-08-15T12:00:00Z');
  const { fixtures } = await todayWindowQuery(cup, now).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].id).toBe('e1');
});

test('season fixtures degrade to BBC-derived alone when the ESPN leg fails', async () => {
  stubCupFetch({ failEspn: true });
  const { fixtures } = await seasonFixturesQuery(cup).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].id).toBe('bbc-b1');
  // teams leg still succeeded, so re-identification still happens
  expect(fixtures[0].home.teamId).toBe('1');
});

test('season fixtures keep BBC identity (no re-identification) when the teams leg fails', async () => {
  stubCupFetch({ failTeams: true });
  const { fixtures } = await seasonFixturesQuery(cup).queryFn();
  const merged = fixtures.find(f => f.id === 'bbc-b1');
  expect(merged).toBeDefined();
  // Not re-identified — keeps its own BBC-side id, not the ESPN teamId.
  expect(merged.home.teamId).toBe('h');
});

test('season fixtures throw when all three legs fail', async () => {
  stubCupFetch({ failEspn: true, failBbc: true, failTeams: true });
  await expect(seasonFixturesQuery(cup).queryFn()).rejects.toThrow();
});

test('a plain ESPN comp without a bbcTournament makes no BBC or teams requests (unchanged behaviour)', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    return new Response(espnScoreboard(), { status: 200 });
  }));
  const plain = { id: 'sco.tennents', source: 'espn' };
  await seasonFixturesQuery(plain).queryFn();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('/scoreboard');
});

// F1 (spec §13.11): the three UEFA club competitions merge their own
// scoreboard with a second ESPN code carrying qualifying rounds.
const qualComp = { id: 'uefa.europa', source: 'espn', espnQualifier: 'uefa.europa_qual' };

const mainScoreboard = () => JSON.stringify({
  events: [{
    id: 'main1', date: '2026-09-01T19:00:00Z', status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '10', displayName: 'Celtic' } },
      { homeAway: 'away', team: { id: '20', displayName: 'Real Madrid' } },
    ] }],
  }],
});

const qualScoreboard = () => JSON.stringify({
  events: [{
    id: 'qual1', date: '2026-07-15T18:00:00Z', status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '30', displayName: 'Shamrock Rovers' } },
      { homeAway: 'away', team: { id: '40', displayName: 'Ararat-Armenia' } },
    ] }],
  }],
});

// Both legs carry the SAME fixture id — an edge case dedupe must handle
// even though it shouldn't occur with real ESPN data (main-draw and
// qualifying-rounds events are distinct matches upstream).
const dupeMainScoreboard = () => JSON.stringify({
  events: [{
    id: 'dup', date: '2026-07-20T19:00:00Z', status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '10', displayName: 'Main Side' } },
      { homeAway: 'away', team: { id: '20', displayName: 'Real Madrid' } },
    ] }],
  }],
});

const dupeQualScoreboard = () => JSON.stringify({
  events: [{
    id: 'dup', date: '2026-07-20T19:00:00Z', status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [{ competitors: [
      { homeAway: 'home', team: { id: '99', displayName: 'Qual Side' } },
      { homeAway: 'away', team: { id: '20', displayName: 'Real Madrid' } },
    ] }],
  }],
});

function stubQualifierFetch({ failMain = false, failQual = false, dupe = false } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    // uefa.europa_qual must be checked first — 'uefa.europa' is a prefix
    // of it, so the reverse order would misroute the qualifier request.
    if (url.includes('/uefa.europa_qual/scoreboard')) {
      if (failQual) return new Response('down', { status: 500 });
      return new Response(dupe ? dupeQualScoreboard() : qualScoreboard(), { status: 200 });
    }
    if (url.includes('/uefa.europa/scoreboard')) {
      if (failMain) return new Response('down', { status: 500 });
      return new Response(dupe ? dupeMainScoreboard() : mainScoreboard(), { status: 200 });
    }
    throw new Error(`unexpected url ${url}`);
  }));
  return calls;
}

test('season fixtures for an espnQualifier comp fetch both scoreboard codes and merge, sorted by kickoff, all under the parent compId', async () => {
  const calls = stubQualifierFetch();
  const { fixtures } = await seasonFixturesQuery(qualComp).queryFn();
  expect(calls.some(u => u.includes('/uefa.europa/scoreboard'))).toBe(true);
  expect(calls.some(u => u.includes('/uefa.europa_qual/scoreboard'))).toBe(true);
  expect(fixtures).toHaveLength(2);
  expect(fixtures.every(f => f.compId === 'uefa.europa')).toBe(true);
  // qual1 (July) kicks off before main1 (September) — sorted, not just concatenated.
  expect(fixtures.map(f => f.id)).toEqual(['qual1', 'main1']);
});

test('season fixtures for an espnQualifier comp dedupe a fixture id shared by both legs, main leg wins', async () => {
  stubQualifierFetch({ dupe: true });
  const { fixtures } = await seasonFixturesQuery(qualComp).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].home.name).toBe('Main Side');
});

test('season fixtures for an espnQualifier comp still return main-leg fixtures when the qualifier leg fails', async () => {
  stubQualifierFetch({ failQual: true });
  const { fixtures } = await seasonFixturesQuery(qualComp).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].id).toBe('main1');
});

test('season fixtures for an espnQualifier comp still return qualifier-leg fixtures when the main leg fails', async () => {
  stubQualifierFetch({ failMain: true });
  const { fixtures } = await seasonFixturesQuery(qualComp).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].id).toBe('qual1');
});

test('season fixtures for an espnQualifier comp throw when both legs fail', async () => {
  stubQualifierFetch({ failMain: true, failQual: true });
  await expect(seasonFixturesQuery(qualComp).queryFn()).rejects.toThrow();
});

test('today window for an espnQualifier comp fetches both scoreboard codes and merges under the parent compId', async () => {
  const calls = stubQualifierFetch();
  const now = new Date('2026-08-14T12:00:00Z');
  const { fixtures } = await todayWindowQuery(qualComp, now).queryFn();
  expect(calls.some(u => u.includes('/uefa.europa/scoreboard'))).toBe(true);
  expect(calls.some(u => u.includes('/uefa.europa_qual/scoreboard'))).toBe(true);
  expect(fixtures).toHaveLength(2);
  expect(fixtures.every(f => f.compId === 'uefa.europa')).toBe(true);
});

test('today window for an espnQualifier comp still returns main-leg fixtures when the qualifier leg fails', async () => {
  stubQualifierFetch({ failQual: true });
  const now = new Date('2026-08-14T12:00:00Z');
  const { fixtures } = await todayWindowQuery(qualComp, now).queryFn();
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].id).toBe('main1');
});

test('a plain ESPN comp without an espnQualifier makes no second scoreboard fetch (unchanged behaviour)', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    return new Response(espnScoreboard(), { status: 200 });
  }));
  const plain = { id: 'uefa.champions', source: 'espn' }; // no espnQualifier on this test double
  await seasonFixturesQuery(plain).queryFn();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('/scoreboard');
});

// --- usePlayer: home-league hotfix (spec §13.16 regression, Aug 2026) ---
// ESPN only populates a player's statistics under their club's domestic
// league grouping; a UEFA/cup comp 404s on the statistics leg even
// though the bio itself fetches fine there. See src/data/queries.js.

test('usePlayer: a bio carrying a defaultLeague $ref routes the statistics fetch there, even when the route comp is uefa.champions', async () => {
  const bioPayload = {
    id: '272624', displayName: 'Kasper Høgh',
    defaultLeague: { $ref: 'http://sports.core.api.espn.com/v2/sports/soccer/leagues/sco.1?lang=en&region=us' },
  };
  const statsPayload = { splits: { categories: [{ name: 'general', stats: [{ name: 'appearances', value: 2 }] }] } };
  const fetchSpy = vi.fn(async url => (url.includes('/statistics')
    ? new Response(JSON.stringify(statsPayload), { status: 200 })
    : new Response(JSON.stringify(bioPayload), { status: 200 })));
  vi.stubGlobal('fetch', fetchSpy);

  const comp = { id: 'uefa.champions', source: 'espn' };
  const { result } = renderHook(() => usePlayer(comp, '272624'), { wrapper });

  await waitFor(() => expect(result.current.stats).not.toBeNull());

  const urls = fetchSpy.mock.calls.map(c => c[0]);
  const statsUrl = urls.find(u => u.includes('/statistics'));
  const bioUrl = urls.find(u => !u.includes('/statistics'));
  expect(statsUrl).toContain('/v2/sports/soccer/leagues/sco.1/seasons/'); // resolved to the domestic league
  expect(statsUrl).not.toContain('/leagues/uefa.champions/');
  expect(bioUrl).toContain('/v2/sports/soccer/leagues/uefa.champions/seasons/'); // bio still under the route comp
  expect(result.current.stats.appearances).toBe(2);
});

test('usePlayer: a statistics 404 leaves stats null but bio populated, and isError stays false', async () => {
  const bioPayload = { id: '272624', displayName: 'Kasper Høgh' }; // no defaultLeague -> falls back to comp.id
  vi.stubGlobal('fetch', vi.fn(async url => (url.includes('/statistics')
    ? new Response('not found', { status: 404 })
    : new Response(JSON.stringify(bioPayload), { status: 200 }))));

  const comp = { id: 'sco.1', source: 'espn' };
  const { result } = renderHook(() => usePlayer(comp, '272624'), { wrapper });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(result.current.bio?.name).toBe('Kasper Høgh');
  expect(result.current.stats).toBeNull();
  expect(result.current.isError).toBe(false);
});

test('usePlayer: an athlete-bio failure sets isError true, bio stays null, and statistics is never fetched', async () => {
  const fetchSpy = vi.fn(async url => (url.includes('/statistics')
    ? Promise.reject(new Error('statistics should never be fetched when bio fails'))
    : new Response('server error', { status: 500 })));
  vi.stubGlobal('fetch', fetchSpy);

  const comp = { id: 'sco.1', source: 'espn' };
  const { result } = renderHook(() => usePlayer(comp, '272624'), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(result.current.bio).toBeNull();
  expect(fetchSpy.mock.calls.some(c => c[0].includes('/statistics'))).toBe(false);
});

// --- useSquad: home-league hotfix — teams/{id}?enable=roster returns
// an empty athletes[] under a UEFA/cup comp; fall back through the
// domestic groupings until one is non-empty (or exhaust them). ---

const rosterWithAthletes = count => JSON.stringify({
  team: { athletes: Array.from({ length: count }, (_, i) => ({ id: String(i + 1), displayName: `Player ${i + 1}` })) },
});
const emptyRoster = JSON.stringify({ team: { athletes: [] } });

test('useSquad: a uefa.champions route falls back to sco.1 and resolves the 27-player squad found there', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/uefa.champions/teams/256')) return new Response(emptyRoster, { status: 200 });
    if (url.includes('/sco.1/teams/256')) return new Response(rosterWithAthletes(27), { status: 200 });
    throw new Error(`unexpected url ${url}`);
  }));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '256'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(27));
  expect(result.current.data.resolvedCompId).toBe('sco.1');
  expect(calls.some(u => u.includes('/uefa.champions/teams/256'))).toBe(true);
  expect(calls.some(u => u.includes('/sco.1/teams/256'))).toBe(true);
});

test('useSquad: a domestic route (already sco.1) resolves on the first fetch — no fallback calls', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    return new Response(rosterWithAthletes(20), { status: 200 });
  }));

  const comp = { id: 'sco.1', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '256'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(20));
  expect(calls).toHaveLength(1);
  expect(result.current.data.resolvedCompId).toBe('sco.1');
});

test('useSquad: an empty athletes array on every leg resolves players: [] — never a query error', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(emptyRoster, { status: 200 })));

  const comp = { id: 'uefa.europa', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '999'), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data.players).toEqual([]);
  expect(result.current.data.resolvedCompId).toBeNull();
  expect(result.current.isError).toBe(false);
});

test('useSquad: when the route comp is itself a fallback league, it is fetched once, not twice', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/eng.1/teams/500')) return new Response(rosterWithAthletes(3), { status: 200 });
    return new Response(emptyRoster, { status: 200 }); // route (sco.1) and sco.2 both empty
  }));

  const comp = { id: 'sco.1', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '500'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(3));
  expect(calls.filter(u => u.includes('/sco.1/teams/500'))).toHaveLength(1);
  expect(calls.some(u => u.includes('/sco.2/teams/500'))).toBe(true);
  expect(result.current.data.resolvedCompId).toBe('eng.1');
});

// --- the scout (spec §13.20): a foreign UEFA-scope response often carries
// no roster of its own, but names the club's actual domestic league under
// team.defaultLeague — discovered once, tried NEXT (ahead of the generic
// sco/eng fallbacks), so a genuinely foreign club (never sco/eng) still
// resolves a squad, and the resolving response's record comes along too.
// Live-verified shapes (uefa.champions/teams/4411, aut.1/teams/4411). ---

const foreignRecordRoster = JSON.stringify({
  team: {
    athletes: Array.from({ length: 26 }, (_, i) => ({ id: String(i + 1), displayName: `Player ${i + 1}` })),
    record: { items: [{ type: 'total', summary: '3-0-0', stats: [
      { name: 'gamesPlayed', value: 3 }, { name: 'losses', value: 0 },
      { name: 'points', value: 9 }, { name: 'pointsAgainst', value: 1 },
      { name: 'pointDifferential', value: 8 },
    ] }] },
  },
});

test('useSquad: the scout — a defaultLeague named under the route comp is discovered and tried next, resolving with league name + record', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/uefa.champions/teams/4411')) {
      return new Response(JSON.stringify({
        team: { athletes: [], defaultLeague: { slug: 'aut.1', name: 'Austrian Bundesliga' } },
      }), { status: 200 });
    }
    if (url.includes('/aut.1/teams/4411')) return new Response(foreignRecordRoster, { status: 200 });
    throw new Error(`unexpected url ${url}`);
  }));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '4411'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(26));
  expect(result.current.data.resolvedCompId).toBe('aut.1');
  expect(result.current.data.discovered).toBe(true);
  expect(result.current.data.resolvedLeagueName).toBe('Austrian Bundesliga');
  expect(result.current.data.record).toEqual({ played: 3, wins: 3, draws: 0, losses: 0, points: 9 });
  // Tried NEXT — ahead of the generic sco/eng fallbacks, which are never
  // reached once the discovered league resolves.
  expect(calls.some(u => u.includes('/sco.1/teams/4411'))).toBe(false);
  expect(calls.some(u => u.includes('/sco.2/teams/4411'))).toBe(false);
  expect(calls.some(u => u.includes('/eng.1/teams/4411'))).toBe(false);
  // Review round 2 (Finding 2): this fixture's resolving response carries
  // no defaultLeague.season.year (matching today's real ESPN shape, live-
  // probed — see task-1-report.md) — recordSeasonYear stays null.
  expect(result.current.data.recordSeasonYear).toBeNull();
});

// --- the scout (review round 2, HIGH fix): a positive shape guard on
// discovered slugs — a genuine domestic league is a short country/region
// code, a dot, then a numeric tier (sco.1, aut.1, cyp.1). Nothing UEFA-
// qualifier- or Club-Friendly-shaped can ever match, so those are never
// queued as a candidate and never mark the squad discovered. ---

test('useSquad: the scout — a UEFA-qualifier-shaped defaultLeague slug is never queued or discovered (shape guard)', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/uefa.champions/teams/999')) {
      return new Response(JSON.stringify({
        team: { athletes: [], defaultLeague: { slug: 'uefa.champions_qual', name: 'UEFA Champions League Qualifying' } },
      }), { status: 200 });
    }
    if (url.includes('/eng.1/teams/999')) return new Response(rosterWithAthletes(5), { status: 200 });
    return new Response(emptyRoster, { status: 200 }); // sco.1, sco.2 both empty
  }));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '999'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(5));
  // The qualifier-shaped slug is never fetched at all — the shape guard
  // rejects it before it's ever spliced into candidates.
  expect(calls.some(u => u.includes('uefa.champions_qual'))).toBe(false);
  expect(result.current.data.resolvedCompId).toBe('eng.1');
  expect(result.current.data.discovered).toBeUndefined();
});

test('useSquad: the scout — a Club-Friendly-shaped defaultLeague slug is never queued or discovered (shape guard)', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/uefa.europa/teams/999')) {
      return new Response(JSON.stringify({
        team: { athletes: [], defaultLeague: { slug: 'misc.friendly', name: 'Club Friendly' } },
      }), { status: 200 });
    }
    if (url.includes('/eng.1/teams/999')) return new Response(rosterWithAthletes(4), { status: 200 });
    return new Response(emptyRoster, { status: 200 });
  }));

  const comp = { id: 'uefa.europa', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '999'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(4));
  expect(calls.some(u => u.includes('misc.friendly'))).toBe(false);
  expect(result.current.data.resolvedCompId).toBe('eng.1');
  expect(result.current.data.discovered).toBeUndefined();
});

test('useSquad: the scout — a second real country-tier slug (cyp.1, the Pafos case) still passes the shape guard and is discovered', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.includes('/uefa.europa.conf/teams/22281')) {
      return new Response(JSON.stringify({
        team: { athletes: [], defaultLeague: { slug: 'cyp.1', name: 'Cypriot First Division' } },
      }), { status: 200 });
    }
    if (url.includes('/cyp.1/teams/22281')) return new Response(rosterWithAthletes(24), { status: 200 });
    throw new Error(`unexpected url ${url}`);
  }));

  const comp = { id: 'uefa.europa.conf', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '22281'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(24));
  expect(result.current.data.resolvedCompId).toBe('cyp.1');
  expect(result.current.data.discovered).toBe(true);
  expect(result.current.data.resolvedLeagueName).toBe('Cypriot First Division');
});

test('useSquad: the scout — recordSeasonYear reads defaultLeague.season.year from the resolving response when ESPN provides one', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.includes('/uefa.champions/teams/4411')) {
      return new Response(JSON.stringify({
        team: { athletes: [], defaultLeague: { slug: 'aut.1', name: 'Austrian Bundesliga' } },
      }), { status: 200 });
    }
    if (url.includes('/aut.1/teams/4411')) {
      return new Response(JSON.stringify({
        team: {
          athletes: Array.from({ length: 2 }, (_, i) => ({ id: String(i + 1), displayName: `Player ${i + 1}` })),
          defaultLeague: { slug: 'aut.1', name: 'Austrian Bundesliga', season: { year: 2026 } },
          record: { items: [{ type: 'total', stats: [
            { name: 'gamesPlayed', value: 3 }, { name: 'wins', value: 3 }, { name: 'ties', value: 0 },
            { name: 'losses', value: 0 }, { name: 'points', value: 9 },
          ] }] },
        },
      }), { status: 200 });
    }
    throw new Error(`unexpected url ${url}`);
  }));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '4411'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(2));
  expect(result.current.data.recordSeasonYear).toBe(2026);
});

test('useSquad: a club resolving under a fallback league (sco.1) is never marked discovered — no scout fields', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.includes('/uefa.champions/teams/256')) return new Response(emptyRoster, { status: 200 });
    if (url.includes('/sco.1/teams/256')) return new Response(rosterWithAthletes(27), { status: 200 });
    throw new Error(`unexpected url ${url}`);
  }));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '256'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(27));
  expect(result.current.data.resolvedCompId).toBe('sco.1');
  expect(result.current.data.discovered).toBeUndefined();
  expect(result.current.data.resolvedLeagueName).toBeUndefined();
  expect(result.current.data.record).toBeUndefined();
});

test('useSquad: loop guard — a defaultLeague pointing at an already-tried slug (even the route comp itself) is never requeued', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    // Every empty leg reports defaultLeague pointing back at sco.1 — the
    // route comp, already tried first — so it must never be queued again.
    if (url.includes('/eng.1/teams/256')) return new Response(rosterWithAthletes(5), { status: 200 });
    return new Response(JSON.stringify({
      team: { athletes: [], defaultLeague: { slug: 'sco.1', name: 'Scottish Premiership' } },
    }), { status: 200 });
  }));

  const comp = { id: 'sco.1', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '256'), { wrapper });

  await waitFor(() => expect(result.current.data?.players?.length).toBe(5));
  expect(calls.filter(u => u.includes('/sco.1/teams/256'))).toHaveLength(1);
  expect(result.current.data.resolvedCompId).toBe('eng.1');
  expect(result.current.data.discovered).toBeUndefined();
});

// --- outage vs legit-empty (backlog, gold sweep): every leg THROWING (a
// real fetch failure) must surface as isError, never cache as a resolved
// players: [] — that would read as "Squad details unavailable." for the
// rest of the 24h staleTime even once the outage clears. ---

test('useSquad: every leg throwing (a full outage) rethrows — isError true, never cached as legit-empty', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '256'), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});

test('useSquad: one leg throwing but a later leg cleanly resolving empty is NOT an error — a real 200 with 0 athletes', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url.includes('/uefa.champions/teams/256')) throw new TypeError('network error');
    return new Response(emptyRoster, { status: 200 });
  }));

  const comp = { id: 'uefa.champions', hasSquads: true };
  const { result } = renderHook(() => useSquad(comp, '256'), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data.players).toEqual([]);
  expect(result.current.isError).toBe(false);
});

// --- useNews (spec §13.19.2): fetches the proxy's raw XML text and adapts
// it via adaptFeed — a plain-text fetch, not getJson (the feed is XML). ---

test('useNews fetches /api/news?feed=<feed> and adapts the XML body into items', async () => {
  const calls = [];
  const xml = '<rss><channel><item>'
    + '<title>Celtic win</title><link>https://bbc.co.uk/1</link>'
    + '<guid>https://bbc.co.uk/1</guid><pubDate>Thu, 13 Aug 2026 09:00:00 GMT</pubDate>'
    + '</item></channel></rss>';
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    return new Response(xml, { status: 200 });
  }));

  const { result } = renderHook(() => useNews('celtic'), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls).toEqual(['/api/news?feed=celtic']);
  expect(result.current.data.items).toHaveLength(1);
  expect(result.current.data.items[0].title).toBe('Celtic win');
  expect(result.current.data.items[0].link).toBe('https://bbc.co.uk/1');
});

test('useNews surfaces isError on a failed fetch rather than throwing past the hook', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));

  const { result } = renderHook(() => useNews('football'), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
});

// --- useHighlights (spec §13.36): one episodes/last.json per iplayer
// brand in the registry (b007t9y1 MOTD on eng.1, m002jryr Sportscene on
// sco.1), then the pid's detail for the long synopsis. A failed or null
// comp is simply omitted — absence is not degradation here. ---

const lastJson = (pid, short) => JSON.stringify({
  broadcasts: [{
    is_repeat: true, schedule_date: '2026-08-24',
    programme: {
      pid, first_broadcast_date: '2026-08-23T22:30:00+01:00',
      available_until: '2026-09-22T22:59:00+01:00', short_synopsis: short,
    },
  }],
});

const episodeJson = (pid, long) => JSON.stringify({
  programme: { pid, first_broadcast_date: '2026-08-23T22:30:00+01:00', long_synopsis: long },
});

test('useHighlights fetches both brands via the proxy, upgrades to the long synopsis, and builds iPlayer deep links', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url === '/api/iplayer/b007t9y1/episodes/last.json') return new Response(lastJson('m002motd', 'MOTD short'), { status: 200 });
    if (url === '/api/iplayer/m002jryr/episodes/last.json') return new Response(lastJson('m002scen', 'Sportscene short'), { status: 200 });
    if (url === '/api/iplayer/m002motd.json') return new Response(episodeJson('m002motd', 'Arsenal host Manchester City.'), { status: 200 });
    if (url === '/api/iplayer/m002scen.json') return new Response(episodeJson('m002scen', 'Premiership highlights in full.'), { status: 200 });
    throw new Error(`unexpected url ${url}`);
  }));

  const { result } = renderHook(() => useHighlights(), { wrapper });

  await waitFor(() => expect(result.current).toHaveLength(2));
  await waitFor(() => expect(result.current.every(e => e.synopsis?.includes('short') === false)).toBe(true));

  const motd = result.current.find(e => e.pid === 'm002motd');
  expect(motd.comp.id).toBe('eng.1');
  expect(motd.show).toBe('Match of the Day');
  expect(motd.date).toBe('2026-08-23');
  expect(motd.availableUntil).toBe('2026-09-22T22:59:00+01:00');
  expect(motd.synopsis).toBe('Arsenal host Manchester City.'); // long preferred over short
  expect(motd.url).toBe('https://www.bbc.co.uk/iplayer/episode/m002motd');
  const scene = result.current.find(e => e.pid === 'm002scen');
  expect(scene.comp.id).toBe('sco.1');
  expect(scene.show).toBe('Sportscene');
  // Every request went through our proxy — never to bbc.co.uk directly.
  expect(calls.every(u => u.startsWith('/api/iplayer/'))).toBe(true);
});

test('useHighlights omits a brand whose fetch fails and keeps the other — never all-or-nothing', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url === '/api/iplayer/b007t9y1/episodes/last.json') return new Response('<html>BBC error page</html>', { status: 500 });
    if (url === '/api/iplayer/m002jryr/episodes/last.json') return new Response(lastJson('m002scen', 'Sportscene short'), { status: 200 });
    if (url === '/api/iplayer/m002scen.json') return new Response(episodeJson('m002scen', 'Premiership highlights.'), { status: 200 });
    throw new Error(`unexpected url ${url}`);
  }));

  const { result } = renderHook(() => useHighlights(), { wrapper });

  await waitFor(() => expect(result.current).toHaveLength(1));
  expect(result.current[0].pid).toBe('m002scen');
});

test('useHighlights keeps the short synopsis when the episode-detail tier fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.endsWith('/episodes/last.json')) {
      const pid = url.includes('b007t9y1') ? 'm002motd' : 'm002scen';
      return new Response(lastJson(pid, 'the short synopsis'), { status: 200 });
    }
    return new Response('<html>gone</html>', { status: 500 }); // detail tier down
  }));

  const { result } = renderHook(() => useHighlights(), { wrapper });

  await waitFor(() => expect(result.current).toHaveLength(2));
  expect(result.current.every(e => e.synopsis === 'the short synopsis')).toBe(true);
});

// --- useUpcomingBroadcasts (spec §13.43, the airtime foot): one
// episodes/upcoming.json per iplayer brand, adapted and flattened to
// broadcast lines with comp + show. [] while loading or failed — absence
// is honest, never degradation. Payload fixtures mirror the live-probed
// truth (2026-08-29): channel at service.title, brand name at
// display_titles (plural). ---

const upcomingJson = (pid, show, channel, times) => JSON.stringify({
  broadcasts: times.map(([start, end]) => ({
    is_repeat: false, is_blanked: false, schedule_date: start.slice(0, 10),
    start, end,
    service: { type: 'tv', id: 'svc', key: 'svc', title: channel },
    programme: { pid, title: start.slice(8, 10) + '/08/2026', display_titles: { title: show } },
  })),
});

test('useUpcomingBroadcasts fetches both brands via the proxy and flattens broadcasts with comp and show', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    if (url === '/api/iplayer/b007t9y1/episodes/upcoming.json') {
      return new Response(upcomingJson('m003116q', 'Match of the Day', 'BBC One', [
        ['2026-08-29T22:25:00+01:00', '2026-08-29T23:35:00+01:00'],
        ['2026-08-30T08:50:00+01:00', '2026-08-30T10:00:00+01:00'],
      ]), { status: 200 });
    }
    if (url === '/api/iplayer/m002jryr/episodes/upcoming.json') {
      return new Response(upcomingJson('m00312s3', 'Sportscene: Premiership Highlights', 'BBC Scotland', [
        ['2026-08-29T19:15:00+01:00', '2026-08-29T20:15:00+01:00'],
      ]), { status: 200 });
    }
    throw new Error(`unexpected url ${url}`);
  }));

  const { result } = renderHook(() => useUpcomingBroadcasts(), { wrapper });

  expect(result.current).toEqual([]); // loading — the honest empty schedule

  await waitFor(() => expect(result.current).toHaveLength(3));
  // Registry order leads: sco.1 (Sportscene) sits before eng.1 in the
  // registry, so its broadcast flattens first.
  const scene = result.current[0];
  expect(scene.comp.id).toBe('sco.1');
  expect(scene.show).toBe('Sportscene');
  expect(scene.channel).toBe('BBC Scotland');
  const motd = result.current[1];
  expect(motd.comp.id).toBe('eng.1');
  expect(motd.show).toBe('Match of the Day');
  expect(motd.pid).toBe('m003116q');
  expect(motd.title).toBe('Match of the Day');
  expect(motd.start).toBe('2026-08-29T22:25:00+01:00');
  expect(motd.end).toBe('2026-08-29T23:35:00+01:00');
  expect(motd.channel).toBe('BBC One');
  expect(result.current[2].comp.id).toBe('eng.1'); // MOTD's second broadcast
  // Every request went through our proxy — never to bbc.co.uk directly.
  expect(calls.every(u => u.startsWith('/api/iplayer/'))).toBe(true);
});

test('useUpcomingBroadcasts keeps the healthy brand when the other fails — never all-or-nothing', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url === '/api/iplayer/b007t9y1/episodes/upcoming.json') {
      return new Response('<html>BBC error page</html>', { status: 500 });
    }
    if (url === '/api/iplayer/m002jryr/episodes/upcoming.json') {
      return new Response(upcomingJson('m00312s3', 'Sportscene: Premiership Highlights', 'BBC Scotland', [
        ['2026-08-29T19:15:00+01:00', '2026-08-29T20:15:00+01:00'],
      ]), { status: 200 });
    }
    throw new Error(`unexpected url ${url}`);
  }));

  const { result } = renderHook(() => useUpcomingBroadcasts(), { wrapper });

  await waitFor(() => expect(result.current).toHaveLength(1));
  expect(result.current[0].pid).toBe('m00312s3');
  expect(result.current[0].show).toBe('Sportscene');
});

// --- The Scout's Dossier hooks (spec §13.37): lazy, enabled-gated raw
// fetches through /api/dossier — identity logic lives in the domain
// layer, so these tests pin only the proxy discipline (encoded paths,
// one hop) and the enabled gate. Adapter behaviour is pinned in
// dossier.test.js. ---

test('useWikiSummary fetches the encoded title through the dossier proxy and adapts the summary', async () => {
  const calls = [];
  const summary = {
    title: 'James Forrest (footballer, born 1991)', type: 'standard',
    extract: 'Plays for Celtic.', thumbnail: { source: 'https://upload.wikimedia.org/jf.jpg' },
  };
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    return new Response(JSON.stringify(summary), { status: 200 });
  }));

  const { result } = renderHook(
    () => useWikiSummary('James Forrest (footballer, born 1991)', true),
    { wrapper },
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  // Encoded, and through our proxy — never to wikipedia.org directly.
  expect(calls).toEqual(['/api/dossier/wiki/summary/James%20Forrest%20(footballer%2C%20born%201991)']);
  expect(result.current.data.kind).toBe('standard');
  expect(result.current.data.portrait).toBe('https://upload.wikimedia.org/jf.jpg');
});

test('useWikiSummary stays idle (no fetch) until enabled with a title — enrichment is lazy', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);

  const idle = renderHook(() => useWikiSummary('James Forrest', false), { wrapper });
  const untitled = renderHook(() => useWikiSummary(null, true), { wrapper });

  expect(idle.result.current.fetchStatus).toBe('idle');
  expect(untitled.result.current.fetchStatus).toBe('idle');
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('useTsdbPlayers adapts TSDB’s live no-hits shape {"player":null} to an empty array', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async url => {
    calls.push(url);
    return new Response(JSON.stringify({ player: null }), { status: 200 });
  }));

  const { result } = renderHook(() => useTsdbPlayers('James Forrest', true), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls).toEqual(['/api/dossier/tsdb/James%20Forrest']);
  expect(result.current.data).toEqual([]);
});
