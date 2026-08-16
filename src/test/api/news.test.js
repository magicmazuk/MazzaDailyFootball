import { beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/news.js';

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

test('rejects unknown or missing feeds without fetching', async () => {
  const spy = vi.fn();
  vi.stubGlobal('fetch', spy);
  expect((await call('/api/news?feed=arsenal')).statusCode).toBe(400);
  expect((await call('/api/news')).statusCode).toBe(400);
  expect((await call('/api/news?feed=')).statusCode).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

test('no arbitrary URL passthrough — an unrecognised feed value never reaches fetch, whatever shape it takes', async () => {
  const spy = vi.fn();
  vi.stubGlobal('fetch', spy);
  const res = await call(`/api/news?feed=${encodeURIComponent('https://evil.example.com/x.xml')}`);
  expect(res.statusCode).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

// FEEDS is a plain object literal — a bracket lookup with a prototype-chain
// key (FEEDS['__proto__'], FEEDS['constructor'], FEEDS['toString']) resolves
// to a real, truthy object rather than undefined, which would sail past a
// naive `!upstreamUrl` guard and reach fetch() with a non-URL value —
// surfacing as a misleading 502 instead of the contracted 400. hasOwn-based
// lookup must reject all three the same as any other unknown feed.
test.each(['__proto__', 'constructor', 'toString'])(
  'feed=%s never resolves via the prototype chain — rejected with 400, no fetch', async key => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const res = await call(`/api/news?feed=${key}`);
    expect(res.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  },
);

// The handler's last-known-good Map is module-level and persists for the
// life of this file (same convention as bbc.test.js/espn.test.js) — the
// two "no prior LKG" tests below must run before anything else populates
// the 'celtic' key, so they come first among the feed=celtic cases.

test('a non-200 upstream response with no prior last-known-good surfaces the failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 500 })));
  const res = await call('/api/news?feed=celtic');
  expect(res.statusCode).toBe(500);
});

test('a 200 with a non-XML body is never cached as last-known-good', async () => {
  const url = '/api/news?feed=celtic';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not xml at all', { status: 200 })));
  const first = await call(url);
  // No prior LKG exists yet, so this bad-but-200 response still surfaces —
  // the point under test is that it must not have been STORED as good.
  expect(first.statusCode).not.toBe(200);

  vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 500 })));
  const second = await call(url);
  // If the earlier non-XML 200 had wrongly been cached, this would now 200
  // with that bad body instead of surfacing the failure.
  expect(second.statusCode).toBe(500);
  expect(second.headers['x-lkg-at']).toBeUndefined();
});

test('an HTML doctype error page is never cached as last-known-good; a genuine RSS response afterwards is', async () => {
  const url = '/api/news?feed=celtic';
  const doctypeBody = '<!DOCTYPE html><html><head><title>503 Service Unavailable</title></head>'
    + '<body>Down for maintenance</body></html>';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(doctypeBody, { status: 200 })));
  const first = await call(url);
  // Not recognised as a real feed body, so it surfaces as a failure rather
  // than a false 200 — and, per the assertions below, is never stored.
  expect(first.statusCode).not.toBe(200);

  const goodRss = '<?xml version="1.0"?><rss><channel><item><title>Real story</title></item></channel></rss>';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(goodRss, { status: 200 })));
  const second = await call(url);
  expect(second.statusCode).toBe(200);
  expect(second.body).toBe(goodRss);

  vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
  const third = await call(url);
  // If the doctype page had wrongly been cached, this would now serve ITS
  // body instead of the genuine RSS the second call stored.
  expect(third.statusCode).toBe(200);
  expect(third.body).toBe(goodRss);
});

test('feed=celtic maps to exactly the Celtic team feed and passes the XML body through', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel><item/></channel></rss>', { status: 200 })));
  const res = await call('/api/news?feed=celtic');
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('<rss><channel><item/></channel></rss>');
  expect(res.headers['content-type']).toBe('text/xml');
  expect(res.headers['cache-control']).toBe('public, s-maxage=900, stale-while-revalidate=3600');
  expect(fetch).toHaveBeenCalledWith(
    'https://feeds.bbci.co.uk/sport/football/teams/celtic/rss.xml',
    expect.anything(),
  );
});

test('feed=football maps to exactly the general football feed', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel/></rss>', { status: 200 })));
  const res = await call('/api/news?feed=football');
  expect(res.statusCode).toBe(200);
  expect(fetch).toHaveBeenCalledWith(
    'https://feeds.bbci.co.uk/sport/football/rss.xml',
    expect.anything(),
  );
});

test('failure serves last-known-good with x-lkg-at, and never overwrites it with a bad response', async () => {
  const url = '/api/news?feed=celtic';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><channel><item><title>Good</title></item></channel></rss>', { status: 200 })));
  const good = await call(url);
  expect(good.statusCode).toBe(200);

  vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
  const res = await call(url);
  expect(res.statusCode).toBe(200);
  expect(res.body).toBe('<rss><channel><item><title>Good</title></item></channel></rss>');
  expect(res.headers['x-lkg-at']).toBeTruthy();
});
