import { beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/espn.js';

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
}
const call = async url => {
  const res = fakeRes();
  await handler({ url }, res);
  return res;
};

beforeEach(() => { vi.unstubAllGlobals(); });

test('rejects non-allowlisted paths without touching the network', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call('/api/espn/apis/site/v2/sports/soccer/usa.1/scoreboard');
  expect(res.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('rejects arbitrary path traversal', async () => {
  vi.stubGlobal('fetch', vi.fn());
  const res = await call('/api/espn/apis/site/v2/whatever');
  expect(res.statusCode).toBe(400);
});

test('passes an allowlisted request through with season-fixtures cache headers', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ events: [] }), { status: 200, headers: { 'content-type': 'application/json' } })));
  const res = await call(
    '/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500');
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('public, s-maxage=3600, stale-while-revalidate=604800');
  expect(fetch).toHaveBeenCalledWith(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260701-20270630&limit=500',
    expect.objectContaining({ headers: { accept: 'application/json' } }),
  );
});

test('handles the Vercel rewrite form (?_p=)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"events":[]}', { status: 200 })));
  const res = await call(
    '/api/espn?_p=/apis/v2/sports/soccer/eng.1/standings&season=2026');
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('public, s-maxage=600, stale-while-revalidate=86400');
  expect(fetch).toHaveBeenCalledWith(
    'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2026',
    expect.anything(),
  );
});

test('a short dates window gets the tight live TTL', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"events":[]}', { status: 200 })));
  const res = await call(
    '/api/espn/apis/site/v2/sports/soccer/sco.1/scoreboard?dates=20260812-20260813');
  expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
});

test('upstream failure after a success serves last-known-good with x-lkg-at', async () => {
  const url = '/api/espn/apis/site/v2/sports/soccer/sco.2/teams';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"sports":[1]}', { status: 200 })));
  await call(url);
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
  const res = await call(url);
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('{"sports":[1]}');
  expect(res.headers['x-lkg-at']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(res.headers['cache-control']).toBe('no-store');
});

test('an HTTP-200 error body is treated as failure, not cached as good', async () => {
  const url = '/api/espn/apis/site/v2/sports/soccer/sco.cis/teams';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 })));
  await call(url);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ errors: ['nope'] }), { status: 200 })));
  const res = await call(url);
  expect(res.body).toBe('{"ok":true}'); // last-known-good, not the error body
  expect(res.headers['x-lkg-at']).toBeTruthy();
});

test('failure with no stored fallback passes the upstream status through', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 502 })));
  const res = await call('/api/espn/apis/site/v2/sports/soccer/eng.fa/teams');
  expect(res.statusCode).toBe(502);
  expect(res.headers['cache-control']).toBe('no-store');
});

// spec §13.11 — the three UEFA club competitions' qualifying rounds live
// under a separate ESPN league code (queries.js's comp.espnQualifier).
test('allowlists the UEFA qualifying-rounds codes for scoreboard only', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"events":[]}', { status: 200 })));
  const res = await call(
    '/api/espn/apis/site/v2/sports/soccer/uefa.europa_qual/scoreboard?dates=20260701-20270630&limit=500');
  expect(res.statusCode).toBe(200);
  expect(fetch).toHaveBeenCalledWith(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa_qual/scoreboard?dates=20260701-20270630&limit=500',
    expect.anything(),
  );
});

test('rejects a qualifying-rounds code outside scoreboard (no teams/summary/standings need)', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call('/api/espn/apis/site/v2/sports/soccer/uefa.champions_qual/teams');
  expect(res.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

// spec §13.16 — player bio + statistics live on a different ESPN host
// (sports.core.api.espn.com, no /apis prefix) with their own allowlist.
test('routes the athlete-bio shape to the core-API host with the 24h/7d TTL', async () => {
  const fetchSpy = vi.fn(async () => new Response('{"id":"272624"}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call('/api/espn/v2/sports/soccer/leagues/sco.1/seasons/2026/athletes/272624');
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
  expect(fetchSpy).toHaveBeenCalledWith(
    'https://sports.core.api.espn.com/v2/sports/soccer/leagues/sco.1/seasons/2026/athletes/272624',
    expect.objectContaining({ headers: { accept: 'application/json' } }),
  );
});

test('routes the athlete-statistics shape to the core-API host with the 10min/24h TTL', async () => {
  const fetchSpy = vi.fn(async () => new Response('{"splits":{"categories":[]}}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call(
    '/api/espn/v2/sports/soccer/leagues/sco.1/seasons/2026/types/1/athletes/272624/statistics');
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('public, s-maxage=600, stale-while-revalidate=86400');
  expect(fetchSpy).toHaveBeenCalledWith(
    'https://sports.core.api.espn.com/v2/sports/soccer/leagues/sco.1/seasons/2026/types/1/athletes/272624/statistics',
    expect.anything(),
  );
});

test('a non-numeric athlete id 400s without touching the network', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call('/api/espn/v2/sports/soccer/leagues/sco.1/seasons/2026/athletes/abc123');
  expect(res.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('a non-numeric athlete id 400s on the statistics shape too, without touching the network', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const res = await call(
    '/api/espn/v2/sports/soccer/leagues/sco.1/seasons/2026/types/1/athletes/notanid/statistics');
  expect(res.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

// --- the scout (spec §13.20.1, review-round CRITICAL fix): useSquad
// discovers a foreign opponent's actual domestic league (e.g. 'aut.1')
// from team.defaultLeague and fetches its roster directly — a slug the
// enumerated LEAGUE alternation can never anticipate. Only the single-team
// teams/{id} route (the exact shape useSquad hits) widens to any safe
// slug shape; every other route stays on the tight, enumerated list. ---

test('the scout: a discovered league slug (aut.1) is allowed through the single-team teams route, ?enable=roster included', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ team: { athletes: [] } }), { status: 200 })));
  const res = await call('/api/espn/apis/site/v2/sports/soccer/aut.1/teams/4411?enable=roster');
  expect(res.statusCode).toBe(200);
  expect(fetch).toHaveBeenCalledWith(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/aut.1/teams/4411?enable=roster',
    expect.objectContaining({ headers: { accept: 'application/json' } }),
  );
});

test('the scout: any lowercase-dotted league slug works on the widened route, not just aut.1', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"team":{}}', { status: 200 })));
  const res = await call('/api/espn/apis/site/v2/sports/soccer/ger.1/teams/123?enable=roster');
  expect(res.statusCode).toBe(200);
});

test('the scout: a traversal-ish path in the league slot is still rejected, even on the widened teams route', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const dotdot = await call('/api/espn/apis/site/v2/sports/soccer/../teams/1');
  expect(dotdot.statusCode).toBe(400);
  const encodedSlash = await call('/api/espn/apis/site/v2/sports/soccer/aut%2F1/teams/1');
  expect(encodedSlash.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('the scout: scoreboard/standings/plain teams-list for a discovered league stay rejected — only the single-team route widens', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const scoreboard = await call('/api/espn/apis/site/v2/sports/soccer/aut.1/scoreboard');
  expect(scoreboard.statusCode).toBe(400);
  const standings = await call('/api/espn?_p=/apis/v2/sports/soccer/aut.1/standings');
  expect(standings.statusCode).toBe(400);
  const summary = await call('/api/espn/apis/site/v2/sports/soccer/aut.1/summary');
  expect(summary.statusCode).toBe(400);
  const teamsList = await call('/api/espn/apis/site/v2/sports/soccer/aut.1/teams');
  expect(teamsList.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('other core-API paths off the two player shapes 400 without touching the network', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  // e.g. the position lookup a $ref points at — never proxied directly.
  const res = await call('/api/espn/v2/sports/soccer/leagues/sco.1/positions/19');
  expect(res.statusCode).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});
