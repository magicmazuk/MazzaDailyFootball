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
