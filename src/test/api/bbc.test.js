import { beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/bbc.js';

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

test('rejects unknown tournaments and bad dates without fetching', async () => {
  const spy = vi.fn();
  vi.stubGlobal('fetch', spy);
  expect((await call('/api/bbc?tournament=premier-league&start=2026-08-01&end=2026-08-31')).statusCode).toBe(400);
  expect((await call('/api/bbc?tournament=scottish-league-one&start=nonsense&end=2026-08-31')).statusCode).toBe(400);
  expect((await call('/api/bbc?tournament=scottish-league-one&start=2026-08-01')).statusCode).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

test('builds the upstream URL with the urn and passes the body through', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[]}', { status: 200 })));
  const res = await call('/api/bbc?tournament=scottish-league-one&start=2026-07-01&end=2027-06-30');
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('{"eventGroups":[]}');
  const url = fetch.mock.calls[0][0];
  expect(url).toContain('selectedStartDate=2026-07-01');
  expect(url).toContain('selectedEndDate=2027-06-30');
  expect(url).toContain(encodeURIComponent('urn:bbc:sportsdata:football:tournament:scottish-league-one'));
  // season-length window → season TTL
  expect(res.headers['cache-control']).toBe('public, s-maxage=3600, stale-while-revalidate=604800');
});

test('the League Cup tournament passes through with valid single-day dates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[]}', { status: 200 })));
  const res = await call('/api/bbc?tournament=scottish-league-cup&start=2026-08-15&end=2026-08-15');
  expect(res.statusCode).toBe(200);
  const url = fetch.mock.calls[0][0];
  expect(url).toContain(encodeURIComponent('urn:bbc:sportsdata:football:tournament:scottish-league-cup'));
});

test('a one-day window gets the tight live TTL', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[]}', { status: 200 })));
  const res = await call('/api/bbc?tournament=scottish-league-two&start=2026-08-12&end=2026-08-13');
  expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
});

test('failure serves last-known-good with x-lkg-at', async () => {
  const url = '/api/bbc?tournament=scottish-league-two&start=2026-07-01&end=2027-06-30';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"eventGroups":[1]}', { status: 200 })));
  await call(url);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
  const res = await call(url);
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('{"eventGroups":[1]}');
  expect(res.headers['x-lkg-at']).toBeTruthy();
});
