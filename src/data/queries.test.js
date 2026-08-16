import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { seasonFixturesQuery, todayWindowQuery, usePlayer, useSquad } from './queries.js';

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

  // 2026-07-01 .. 2027-06-30 is 12 calendar months.
  expect(calls).toHaveLength(12);
  for (const url of calls) {
    const u = new URL(url, 'http://x');
    const start = u.searchParams.get('start');
    const end = u.searchParams.get('end');
    // Never a season-long window — start and end must share a calendar month.
    expect(start.slice(0, 7)).toBe(end.slice(0, 7));
    expect(start.endsWith('-01')).toBe(true);
  }
  expect(calls[0]).toContain('start=2026-07-01');
  expect(calls[0]).toContain('end=2026-07-31');
  expect(calls[11]).toContain('start=2027-06-01');
  expect(calls[11]).toContain('end=2027-06-30');
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

  expect(calls).toHaveLength(2);
  for (const url of calls) {
    const u = new URL(url, 'http://x');
    expect(u.searchParams.get('start')).toBe(u.searchParams.get('end'));
  }
  expect(calls[0]).toContain('start=2026-08-13');
  expect(calls[0]).toContain('end=2026-08-13');
  expect(calls[1]).toContain('start=2026-08-14');
  expect(calls[1]).toContain('end=2026-08-14');
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
