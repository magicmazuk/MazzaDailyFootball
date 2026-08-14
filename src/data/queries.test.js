import { beforeEach, expect, test, vi } from 'vitest';
import { seasonFixturesQuery, todayWindowQuery } from './queries.js';

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
